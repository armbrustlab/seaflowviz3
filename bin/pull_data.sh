#!/bin/bash
# Pull data from cruise vessel and upload to sqlshare

while true; do
    shipaddress=$(gawk '{printf "%s", $NF}' ~/shipIP.txt)
    rsync -r --stats --progress -z -v -e 'ssh -p 13389 -i /home/ubuntu/.ssh/id_rsa' "seaflow@$shipaddress":{stat.csv,sfl.csv,cstar.csv} . && \
    gga_fix.py stat.csv stat-gga2dd.csv && \
    gga_fix.py sfl.csv sfl-gga2dd.csv && \
    bincstar.py cstar.csv cstar3min.csv && \
    doit.py; sleep 90;
done
