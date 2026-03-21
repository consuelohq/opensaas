FROM python:3.12-slim

# install node (for just-bash)
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# python deps
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# node deps (just-bash)
COPY package.json package-lock.json .
RUN npm ci

# app code
COPY server.py .
COPY tools/ tools/

EXPOSE 8000

CMD ["python", "server.py"]
