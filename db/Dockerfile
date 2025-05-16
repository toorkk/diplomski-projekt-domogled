FROM postgis/postgis:latest
RUN apt-get update && \
    apt-get install -y locales && \
    echo "sl_SI.UTF-8 UTF-8" >> /etc/locale.gen && \
    locale-gen && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
ENV LANG sl_SI.UTF-8