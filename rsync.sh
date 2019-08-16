#!/bin/sh




params=$1

echo "$params"


if [ $params == 'pro' ]
then
    echo "rsync no plan"
else
   rsync -zvrtopgl --progress --exclude=node_modules --exclude=logs * root@118.31.121.239:/root/tokensky/tonkensky_loan_server
   echo "rsync dev successful"
fi



