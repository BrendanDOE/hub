<?php
// Uses the application's locked, journalled storage and existing upload helpers.
declare(strict_types=1);
$statuses = ['Pending','In Progress','On Hold','Complete'];
$types = ['Design','Print','Digital','Media','General'];
if ($action === 'jobs.attachment') {
    $job = null;
    foreach (readData()['jobs'] ?? [] as $item) if ($item['id'] === ($_GET['id'] ?? '')) $job = $item;
    $index = filter_var($_GET['index'] ?? '', FILTER_VALIDATE_INT);
    $file = $index !== false ? ($job['attachments'][$index] ?? null) : null;
    if (!$file) fail('Attachment not found', 404);
    $path = realpath(__DIR__.'/'.$file['path']); $root = realpath(UPLOAD_DIR);
    if (!$path || !$root || !str_starts_with($path, $root.DIRECTORY_SEPARATOR) || !is_file($path)) fail('Attachment not found', 404);
    header('Content-Type: application/octet-stream');
    header('X-Content-Type-Options: nosniff');
    header('Content-Disposition: attachment; filename="attachment"; filename*=UTF-8\'\''.rawurlencode($file['name']));
    readfile($path); exit;
}
$input = $action === 'jobs.status' ? bodyJson() : $_POST;
$jobId = $input['id'] ?? '';
if (!is_string($jobId)) fail('Invalid job');
$status = $input['status'] ?? 'Pending';
if (!in_array($status, $statuses, true)) fail('Invalid status');
$values = ['status'=>$status];
if ($action === 'jobs.save') {
    foreach (['subject','requester','assignedTo','department','description','dueDate','jobType','priority','artworkType','copies','finishedSize','paperWeight','colour'] as $key) {
        $value = $input[$key] ?? '';
        if (!is_string($value) || strlen($value) > ($key === 'description' ? 10000 : 1000)) fail('Invalid '.$key);
        $values[$key] = trim($value);
    }
    if ($values['subject'] === '' || $values['requester'] === '') fail('Subject and requester are required');
    if (!in_array($values['jobType'], $types, true) || !in_array($values['priority'], ['Low','Medium','High','Urgent'], true)) fail('Invalid type or priority');
    if ($values['dueDate'] !== '') {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $values['dueDate']);
        if (!$date || $date->format('Y-m-d') !== $values['dueDate']) fail('Invalid due date');
    }
    $assets = json_decode(is_string($input['projectAssets'] ?? '') ? ($input['projectAssets'] ?? '[]') : '', true);
    if (!is_array($assets) || !array_is_list($assets) || count($assets) > 20) fail('Invalid project assets');
    $values['projectAssets'] = [];
    foreach ($assets as $asset) {
        $label = is_array($asset) ? ($asset['label'] ?? '') : null; $path = is_array($asset) ? ($asset['path'] ?? '') : null;
        if (!is_string($label) || !is_string($path) || strlen($label) > 200 || strlen($path) > 1000) fail('Invalid project assets');
        $label = trim($label); $path = trim($path);
        if ($label !== '' || $path !== '') $values['projectAssets'][] = ['label'=>$label, 'path'=>$path];
    }
    if ($values['copies'] !== '' && (!ctype_digit($values['copies']) || (int)$values['copies'] < 1 || (int)$values['copies'] > 1000000)) fail('Copies must be between 1 and 1000000');
}
$uploads = $action === 'jobs.save' ? normalizedFiles('attachments') : [];
if (count($uploads) > 10) fail('Attach at most 10 files at a time');
foreach ($uploads as $file) {
    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) continue;
    if ($file['error'] !== UPLOAD_ERR_OK || $file['size'] > 20*1024*1024) fail('Each attachment must be under 20 MB and upload successfully');
    if (!in_array(strtolower(pathinfo($file['name'], PATHINFO_EXTENSION)), ['pdf','png','jpg','jpeg','webp','txt','csv','docx','xlsx','pptx','zip'], true)) fail('Unsupported attachment type');
}
$result = mutateData(function (&$data) use ($action, $input, $jobId, $values, $uploads) {
    $data['jobs'] ??= []; $index = null;
    foreach ($data['jobs'] as $i => $job) if ($job['id'] === $jobId) { $index = $i; break; }
    if ($jobId !== '' && $index === null) fail('Job no longer exists', 404);
    if ($action === 'jobs.status' && $index === null) fail('Job not found', 404);
    $old = $index !== null ? $data['jobs'][$index] : null;
    if ($old && (int)($input['revision'] ?? 0) !== $old['revision']) fail('This job changed elsewhere. Close and reopen it after refreshing before saving.', 409);
    $job = array_replace($old ?? ['id'=>id('job'), 'number'=>1 + max([0, ...array_column($data['jobs'], 'number')]), 'createdAt'=>date(DATE_ATOM), 'attachments'=>[], 'revision'=>0], $values);
    foreach ($uploads as $file) {
        $path = storeUpload($file, $job['id']);
        if ($path) $job['attachments'][] = ['path'=>$path,'name'=>basename($file['name'])];
    }
    $job['updatedAt'] = date(DATE_ATOM); $job['revision']++;
    if ($index === null) $data['jobs'][] = $job; else $data['jobs'][$index] = $job;
    return $job;
});
response($result);
