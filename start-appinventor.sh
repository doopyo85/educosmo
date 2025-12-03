#!/bin/bash
export JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64
export PATH="$JAVA_HOME/bin:$PATH"

cd /var/www/html/appinventor-sources/appinventor/appengine

~/google-cloud-sdk/bin/java_dev_appserver.sh \
  --address=0.0.0.0 \
  --port=8888 \
  --disable_update_check \
  --no_java_agent \
  --jvm_flag=-Dcom.google.appengine.tools.development.disableDatastoretx=true \
  --jvm_flag=-Dcom.google.appengine.tools.development.disableApiSecurity=true \
  build/war

