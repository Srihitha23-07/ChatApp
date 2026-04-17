FROM eclipse-temurin:17-jdk-alpine

WORKDIR /app
COPY . .

# Give permission
RUN chmod +x mvnw

# Build project
RUN ./mvnw clean package -DskipTests

# 🔥 DEBUG (important)
RUN ls -l target

# Run jar (correct way)
CMD ["sh", "-c", "java -jar target/*.jar"]