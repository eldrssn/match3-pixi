# Stage 1: Build the Vite SPA
FROM node:22 AS builder

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install --force

# Копируем остальные файлы приложения
COPY . .

# Собираем приложение. В CI Vite читает build env из builds_file.env/builds_string.env.
RUN npm run build

# Stage 2: Serve the application using Nginx
FROM nginx:alpine

# Устанавливаем nginx-prometheus-exporter
RUN wget https://github.com/nginx/nginx-prometheus-exporter/releases/download/v1.4.2/nginx-prometheus-exporter_1.4.2_linux_amd64.tar.gz \
    && tar -xzf nginx-prometheus-exporter_*.tar.gz \
    && mv nginx-prometheus-exporter /usr/local/bin/ \
    && rm nginx-prometheus-exporter_*.tar.gz

 
# Копируем собранное приложение
COPY --from=builder /app/dist /usr/share/nginx/html

# Настраиваем Nginx
COPY nginx.conf /etc/nginx/nginx.conf

# Открываем порт
EXPOSE 8080

# Запускаем Nginx
CMD ["/bin/sh", "-c", "nginx-prometheus-exporter -nginx.scrape-uri http://127.0.0.1:8080/nginx_status & nginx -g 'daemon off;'"]
