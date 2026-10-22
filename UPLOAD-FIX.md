# Calendar upload diagnostics and configuration fix

Deploy the updated application files, including the hidden `.user.ini`, beside `api.php`. The cPanel deployment script now copies it. Existing upload limits are preserved. `user.ini` is retained for hosts configured to use that filename.

PHP normally reads `.user.ini` under CGI/FastCGI; the host can change or disable this behavior. Configuration changes may take five minutes to be picked up. Web-server, proxy, and hosting security limits are separate.

The supplied network details report HTTP 418, not 413. HUB does not generate 418. This update cannot remove an upstream rejection. If 418 continues, give the hosting provider the failed request URL, timestamp, status, and response headers/body, and ask them to identify the matching security or proxy log entry. Do not disable security rules globally.

HTTP 413 now has a specific browser message. PHP upload errors now distinguish file/request limits, partial uploads, missing files, and server storage failures.

For an existing installation, deploy code and configuration only; do not overwrite live `data/` or `uploads/` with the snapshot in this archive.

Validation: Focused HTTP-error message tests and the existing JavaScript behavior suite passed locally. PHP is unavailable in the supplied workspace, so PHP runtime validation and the hosting-level diagnosis still need the hosting environment.
