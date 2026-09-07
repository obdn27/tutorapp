FROM postgres:latest

RUN openssl genrsa -out /var/lib/postgresql/server.key 2048 && \
    openssl req -new -x509 -days 365 \
    -key /var/lib/postgresql/server.key \
    -out /var/lib/postgresql/server.crt \
    -subj "/CN=localhost"

RUN chown postgres:postgres /var/lib/postgresql/server.key /var/lib/postgresql/server.crt && \
    chmod 600 /var/lib/postgresql/server.key

CMD ["postgres", \
     "-c", "ssl=on", \
     "-c", "ssl_cert_file=/var/lib/postgresql/server.crt", \
     "-c", "ssl_key_file=/var/lib/postgresql/server.key"]