#!/bin/sh

escape_js_string() {
  printf '%s' "$1" \
    | sed \
      -e 's/\\/\\\\/g' \
      -e 's/"/\\"/g' \
      -e 's/</\\u003C/g' \
      -e 's/>/\\u003E/g'
}

POSTHOG_HOST_VALUE="${REACT_APP_POSTHOG_HOST:-https://us.i.posthog.com}"
SANITIZED_REACT_APP_SERVER_BASE_URL=$(escape_js_string "$REACT_APP_SERVER_BASE_URL")
SANITIZED_REACT_APP_POSTHOG_API_KEY=$(escape_js_string "$REACT_APP_POSTHOG_API_KEY")
SANITIZED_REACT_APP_POSTHOG_HOST=$(escape_js_string "$POSTHOG_HOST_VALUE")

echo "Injecting runtime environment variables into index.html..."

CONFIG_BLOCK=$(cat << EOF
    <script id="twenty-env-config">
      window._env_ = {
        REACT_APP_SERVER_BASE_URL: "$SANITIZED_REACT_APP_SERVER_BASE_URL",
        REACT_APP_POSTHOG_API_KEY: "$SANITIZED_REACT_APP_POSTHOG_API_KEY",
        REACT_APP_POSTHOG_HOST: "$SANITIZED_REACT_APP_POSTHOG_HOST"
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
