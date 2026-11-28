# Deploying SMS on Oracle Cloud Infrastructure (OCI)

This guide covers deploying the full **SMS (Smart Medicine Scheduler)** stack (`postgres`, `server`, `web`, and `scheduler`) on an **Oracle Cloud Always Free** Ubuntu VM using Docker Compose.

---

## 1. Provision the OCI Compute Instance

1. In the **Oracle Cloud Console**, navigate to **Compute -> Instances -> Create Instance**.
2. Choose **Ubuntu 24.04 LTS**.
3. Select an Always Free shape:
   - **Recommended**: `VM.Standard.A1.Flex` (Ampere ARM64, e.g., 2 OCPUs / 12 GB RAM) — runs Playwright Chromium + PostgreSQL + Next.js comfortably.
   - **Alternative**: `VM.Standard.E2.1.Micro` (AMD x86_64, 1 GB RAM) — requires at least **2 GB of swap** to prevent Chromium OOM kills.
4. Download the generated SSH private key (`.key`) and place it on your local machine:
   ```bash
   chmod 600 ~/.ssh/oci_sms.key
   ssh -i ~/.ssh/oci_sms.key ubuntu@<PUBLIC_IP>
   ```

---

## 2. Configure Networking & Firewall

Oracle Cloud Ubuntu images enforce host `iptables` rules in addition to the VCN Security List.

1. **OCI VCN Security List**:
   - In **Networking -> Virtual Cloud Networks -> Subnet -> Security List**, add Ingress Rules for TCP ports `3000` (API) and `3001` (Web Dashboard), or `80`/`443` if you place Caddy/Nginx in front.
2. **Host Firewall (on the OCI VM)**:
   ```bash
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
   sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3001 -j ACCEPT
   sudo netfilter-persistent save
   ```

---

## 3. Install Docker & Swap (on the OCI VM)

```bash
# Optional (required for 1 GB E2.1.Micro instances)
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Install Docker Engine + Docker Compose v2
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker
```

---

## 4. Configure Secrets & Launch Stack

```bash
git clone https://github.com/aleocampodev/SMS-Smart-Medicine-Scheduler.git
cd SMS-Smart-Medicine-Scheduler

cp .env.example .env
cp apps/web/.env.schema apps/web/.env 2>/dev/null || true
cp apps/server/.env.schema apps/server/.env 2>/dev/null || true
```

Edit `.env` with your production values:

- `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` (and `TELEGRAM_ALLOWED_CHAT_IDS`)
- `PROFILES_JSON` (compact single-line JSON array of patient profiles — never commit to Git)
- `BETTER_AUTH_SECRET` (32+ random characters)
- `BETTER_AUTH_URL=http://<PUBLIC_IP>:3000`
- `CORS_ORIGIN=http://<PUBLIC_IP>:3001`
- `NEXT_PUBLIC_SERVER_URL=http://<PUBLIC_IP>:3000`

Start PostgreSQL first and push the Drizzle schema, then bring up the full stack:

```bash
docker compose up -d postgres
docker compose up -d --build
docker compose ps
```

Follow scheduler logs:

```bash
docker compose logs -f scheduler
```
