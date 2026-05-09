#!/bin/sh

POSTHOG_HOST_VALUE="${REACT_APP_POSTHOG_HOST:-https://us.i.posthog.com}"

echo "Injecting runtime environment variables into index.html..."

CONFIG_BLOCK=$(cat << EOF
    <script id="twenty-env-config">
      window._env_ = {
        REACT_APP_SERVER_BASE_URL: "$REACT_APP_SERVER_BASE_URL",
        REACT_APP_POSTHOG_API_KEY: "$REACT_APP_POSTHOG_API_KEY",
        REACT_APP_POSTHOG_HOST: "$POSTHOG_HOST_VALUE"
      };
    </script>
    <!-- END: Consuelo Config -->
EOF
)
# Use sed to replace the config block in index.html
# Using pattern space to match across multiple lines
echo "$CONFIG_BLOCK" | sed -i.bak '
  /<!-- BEGIN: Consuelo Config -->/,/<!-- END: Consuelo Config -->/{
    /<!-- BEGIN: Consuelo Config -->/!{
      /<!-- END: Consuelo Config -->/!d
    }
    /<!-- BEGIN: Consuelo Config -->/r /dev/stdin
    /<!-- END: Consuelo Config -->/d
  }
' build/index.html
rm -f build/index.html.bak
