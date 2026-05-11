FROM python:3.12-slim

RUN apt-get update && apt-get install -y curl &&             curl -fsSL https://deb.nodesource.com/setup_22.x | bash - &&             apt-get install -y nodejs &&             apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY package.json package-lock.json .
RUN npm ci

COPY server.py .
COPY tools/ tools/
COPY scripts/ scripts/
COPY BRAIN.example.md .

EXPOSE 8000

CMD ["python", "server.py"]
