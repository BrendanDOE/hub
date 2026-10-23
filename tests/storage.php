<?php
declare(strict_types=1);
// Run: php tests/storage.php. Uses only an isolated temporary directory.
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}
$root = sys_get_temp_dir() . '/hub-storage-test-' . bin2hex(random_bytes(6));
mkdir($root, 0700, true);
define('DATA_FILE', $root . '/app.json');
function ensureStorage(): void
{
}
function defaultData(): array
{
    return ['tiles' => [], 'collections' => [], 'settings' => []];
}
require dirname(__DIR__) . '/history-storage.php';
function check(bool $ok, string $message): void
{
    if (!$ok)
        throw new RuntimeException($message);
}
try {
    $zone = new DateTimeZone('Australia/Perth');
    putenv('HUB_TIMEZONE=Australia/Perth');
    $now = new DateTimeImmutable('now', $zone);
    $last = $now->modify('first day of last month')->setTime(12, 0);
    $older = $last->modify('-1 month');
    $month = $last->format('Y-m');
    $current = ['id' => 'current', 'section' => 'dashboard', 'createdAt' => $now->format(DATE_ATOM)];
    $old = ['id' => 'old', 'section' => 'dashboard', 'createdAt' => $last->format(DATE_ATOM), 'label' => 'Old'];
    $project = ['id' => 'project', 'section' => 'projects', 'createdAt' => $older->format(DATE_ATOM)];
    storageWrite(DATA_FILE, ['tiles' => [$current, $old, $project, ['id' => 'older', 'section' => 'dashboard', 'createdAt' => $older->format(DATE_ATOM)], ['id' => 'undated', 'section' => 'dashboard']], 'collections' => [['id' => 'saved', 'items' => ['old']]], 'settings' => []]);
    $data = storageTransaction();
    check(count($data['tiles']) === 5, 'Rollover lost a tile');
    check(count(storageJson(DATA_FILE)['tiles']) === 3, 'Current dashboard was not partitioned');
    check(count($data['history']) === 2, 'Missed months did not archive separately');
    check(is_file($root . '/' . historyFilename($month)), 'Monthly file missing');
    check($data['collections'][0]['items'] === ['old'], 'Collection ID changed');
    check(count(storageTransaction()['tiles']) === 5, 'Repeated rollover duplicated tiles');
    storageTransaction(function (&$data) {
        foreach ($data['tiles'] as &$tile)
            if ($tile['id'] === 'old')
                $tile['label'] = 'Edited'; });
    $archive = storageJson($root . '/' . historyFilename($month));
    check($archive['tiles'][0]['label'] === 'Edited', 'Archived edit was not persisted');
    $snapshot = storagePartitions(storageTransaction());
    check(isset($snapshot['app.json'], $snapshot[historyFilename($month)]), 'Backup omitted an archive');
    check(count($snapshot['app.json']['tiles']) === 3, 'Backup flattened history');
    // Simulate a committed journal with only the archive written before a crash.
    $snapshot[historyFilename($month)]['tiles'][0]['label'] = 'Recovered';
    storageWrite($root . '/storage-journal.json', $snapshot);
    storageWrite($root . '/' . historyFilename($month), $snapshot[historyFilename($month)]);
    $recovered = storageTransaction();
    check(!is_file($root . '/storage-journal.json'), 'Journal was not completed');
    check(array_values(array_filter($recovered['tiles'], fn($tile) => $tile['id'] === 'old'))[0]['label'] === 'Recovered', 'Journal recovery lost the edit');
    storageTransaction(function (&$data) {
        $data['tiles'] = array_values(array_filter($data['tiles'], fn($tile) => $tile['id'] !== 'old'));
        $data['collections'][0]['items'] = []; });
    check(storageJson($root . '/' . historyFilename($month))['tiles'] === [], 'Deleted archive item reappeared');
    check(count(storageTransaction()['tiles']) === 4, 'Delete did not persist');
    // Legacy jobs migrate once, without modifying IDs or revision counters.
    $legacy = storageJson(DATA_FILE);
    $legacy['jobs'] = [['id'=>'legacy-job', 'number'=>1, 'revision'=>3, 'subject'=>'Legacy']];
    storageWrite(DATA_FILE, $legacy);
    $migrated = storageTransaction();
    check(count($migrated['jobs']) === 1, 'Legacy job was not migrated');
    check(!array_key_exists('jobs', storageJson(DATA_FILE)), 'Jobs remain embedded in app.json');
    check(storageJson($root.'/jobs.json')['jobs'][0]['revision'] === 3, 'Migration changed revisions');
    check(count(storageTransaction()['jobs']) === 1, 'Migration duplicated jobs');
    storageTransaction(function (&$data) { $data['jobs'][0]['subject'] = 'Updated'; });
    check(storageJson($root.'/jobs.json')['jobs'][0]['subject'] === 'Updated', 'Job update was not saved');
    $snapshot = storagePartitions(storageTransaction());
    check(isset($snapshot['jobs.json']) && !isset($snapshot['app.json']['jobs']), 'Backup did not separate jobs');
    $snapshot['jobs.json']['jobs'][0]['subject'] = 'Recovered job';
    storageWrite($root.'/storage-journal.json', $snapshot);
    check(storageTransaction()['jobs'][0]['subject'] === 'Recovered job', 'Journal did not recover jobs');
    $legacy = storageJson(DATA_FILE);
    $legacy['jobs'] = [['id'=>'legacy-job','subject'=>'Stale'],['id'=>'other-job','subject'=>'Keep me']];
    storageWrite(DATA_FILE, $legacy);
    $merged = storageTransaction();
    check(count($merged['jobs']) === 2 && $merged['jobs'][0]['subject'] === 'Recovered job', 'Merge lost jobs or replaced canonical data');
    $goodJobs = file_get_contents($root.'/jobs.json');
    file_put_contents($root.'/jobs.json', '{bad json');
    $rejected = false;
    try { storageTransaction(); } catch (Throwable $error) { $rejected = true; }
    check($rejected && file_get_contents($root.'/jobs.json') === '{bad json', 'Corrupt jobs were silently overwritten');
    file_put_contents($root.'/jobs.json', $goodJobs);
    echo "PASS: dedicated jobs file, legacy migration, idempotency, persistence, backups, journal recovery, merge, and corrupt-file protection.\n";
    echo "PASS: monthly rollover, missed months, stable collection IDs, idempotency, archived edits, backup partitioning, journal recovery, and archived deletion.\n";
} finally {
    foreach (glob($root . '/*') ?: [] as $file)
        unlink($file);
    rmdir($root);
}
