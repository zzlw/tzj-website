FROM docker.m.daocloud.io/neilpang/acme.sh:3.1.0

ARG TARGETARCH
RUN set -eux; \
    case "${TARGETARCH:-amd64}" in \
      arm64) CLI_URL="https://aliyuncli.alicdn.com/aliyun-cli-linux-latest-arm64.tgz" ;; \
      *)     CLI_URL="https://aliyuncli.alicdn.com/aliyun-cli-linux-latest-amd64.tgz" ;; \
    esac; \
    curl -fsSL "$CLI_URL" | tar -xz -C /usr/local/bin aliyun; \
    aliyun version
