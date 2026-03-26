FROM maven:3.9.9-eclipse-temurin-21 AS backend-builder
WORKDIR /app

COPY hotel-backend/hotel-backend/pom.xml ./pom.xml
COPY hotel-backend/hotel-backend/.mvn ./.mvn
COPY hotel-backend/hotel-backend/mvnw hotel-backend/hotel-backend/mvnw.cmd ./
RUN chmod +x mvnw || true
RUN ./mvnw -q -DskipTests dependency:go-offline

COPY hotel-backend/hotel-backend/src ./src
RUN ./mvnw -q -DskipTests clean package

FROM eclipse-temurin:21-jre AS backend-runtime
WORKDIR /app
COPY --from=backend-builder /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]

FROM node:20-alpine AS frontend-builder
WORKDIR /frontend
COPY hotel-frontend/package*.json ./
RUN npm install
COPY hotel-frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine AS nginx-runtime
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-builder /frontend/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
