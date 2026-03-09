#!/bin/bash

# Check if the number of instances was provided
if [ -z "$1" ]; then
  echo "Usage: $0 <number-of-instances>"
  exit 1
fi

num_instances=$1

# Array to store process IDs
declare -a pids

# Function to kill all processes when Ctrl+C is pressed
cleanup() {
  echo "Terminating all instances of ../server..."
  for pid in "${pids[@]}"; do
    kill -SIGTERM "$pid"
  done
  exit
}

# Setup trap for SIGINT
trap 'cleanup' SIGINT

# Start the specified number of instances of the program in the background
for (( i=0; i<num_instances; i++ )); do
  npx tsx ./src/server/index.ts &
  pids+=($!)
done

# Wait for all background processes to finish
wait
