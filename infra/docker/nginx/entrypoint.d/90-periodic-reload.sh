#!/bin/sh
# acme 续期写入新证书后，每 6 小时 reload 使 gateway 生效
(while :; do sleep 6h; nginx -s reload 2>/dev/null || true; done) &
