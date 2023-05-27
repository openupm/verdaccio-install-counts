#!/bin/bash
# Parse the Nginx access log file to generate CSV output with format 'tarballFilename, timestamp' for each package downloaded

# Path to the verdaccio.log file
log_file="/var/log/nginx/verdaccio.log"

# Sort all files with verdaccio.log.<num>.gz or verdaccio.log.<num> or verdaccio.log by the <num> in desc order.
files=$(ls -1v $log_file* | sort -nr -t . -k 3,3)

# Print out the sorted files
# echo "Log files found:"
# echo "$files"

# Use cat or zcat to output the content
for file in $files; do
  if [[ $file == *.gz ]]; then
    zcat $file
  else
    cat $file
  fi
done | grep GET | grep 'tgz HTTP' | grep ' 302' | while read line; do
  # Extract the IP address, HTTP method, package name, version, and timestamp
  ip=$(echo "$line" | awk '{print $1}')
  tarballFilename=$(echo "$line" | awk '{print $7}' | cut -d '/' -f 4)
  timestamp=$(echo "$line" | grep -oP '\[\K[^\]]+' | sed -e 's,/,-,g' -e 's,:, ,')
  js_date=$(date -d "$timestamp" +"%Y-%m-%dT%H:%M:%S.%3NZ")

  # Output the extracted information
  echo "$tarballFilename, $js_date"
done