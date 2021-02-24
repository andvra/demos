#!/bin/bash

# Cloud Build docs: https://peltarion.atlassian.net/wiki/x/DwBpDQ

cloud-build-local --dryrun=false --substitutions COMMIT_SHA=BADC0DE,REPO_NAME=github.com/Peltarion/demos,BRANCH_NAME=test .
