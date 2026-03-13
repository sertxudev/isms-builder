#!/bin/bash
# Restart ISMS Builder server (kills existing process, starts fresh, tails log)
pkill -f "node server/index.js" 2>/dev/null; sleep 1
node server/index.js &>/tmp/isms-server.log &
sleep 2 && cat /tmp/isms-server.log
