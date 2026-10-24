# Deployment Guide: Horizon Watcher on AWS Lightsail

Run the Horizon Watcher (`npm run watch:horizon`) 24/7 on an AWS Lightsail
instance so the laptop can stay off.

> **Caveats**
>
> - Free for the first 3 months on eligible plans (requires a credit card at signup).
> - Datacenter IPs may be penalized by reCAPTCHA v3; the watcher retries the
>   harvest every 10 minutes until it passes.

---

## 1. Create the instance (AWS Console, ~5 minutes)

1. Sign in at <https://lightsail.aws.amazon.com> (same account as AWS).
2. **Create instance** → pick a region (e.g. `us-east-1`, Virginia).
3. **Platform**: Linux/Unix → **Blueprint**: `Node.js 20` (or plain `Ubuntu 24.04 LTS`).
4. **Instance plan**: choose a plan with **2 GB+ RAM** (e.g. 2 GB / 1 vCPU).
   Plans eligible for the 3-month free trial are labeled in the console.
5. Name it `sms-horizon` → **Create instance**.
6. Open the **Networking** tab of the instance → attach/keep a **static IP**.
7. **Connect** via the browser SSH terminal (Connect button) — no local SSH needed.

## 2. Copy the code from the local machine

`profiles.json` and `.env` never go through Git (P-SEC-01); transfer them
inside the tarball:

```bash
# From the LOCAL machine:
cd ~/Work
tar --exclude=sms-smart-medicine-scheduler/node_modules \
    --exclude=sms-smart-medicine-scheduler/dist \
    --exclude=sms-smart-medicine-scheduler/.git \
    -czf sms.tar.gz sms-smart-medicine-scheduler

# Upload to the instance (set the IP from step 1.6):
scp -i <lightsail-default-key.pem> sms.tar.gz ubuntu@<INSTANCE_IP>:~/
```

(The default SSH key `LightsailDefaultKey-<region>` is downloadable from
the Lightsail **Account → SSH keys** page.)

## 3. One-shot setup (on the VPS)

```bash
# Via the Lightsail browser terminal or local SSH:
cd ~ && tar xzf sms.tar.gz && cd sms-smart-medicine-scheduler
chmod +x scripts/setup-vps.sh
sudo ./scripts/setup-vps.sh
```

The script creates 2 GB of swap, installs Node 20 + Xvfb + Chromium
dependencies, installs the project, and registers a `sms-horizon` systemd
service with auto-restart.

## 4. Verify

```bash
journalctl -u sms-horizon -f          # live logs
```

- `Session captured` — reCAPTCHA passed, watcher is live.
- `Harvest rejected. Retrying in 10 min...` — leave it alone; it loops until it passes.
- Telegram alerts arrive on publication events or FREE slots at branch 118.

## 5. Operating notes

- Restart: `sudo systemctl restart sms-horizon`.
- Stop (e.g. to end the trial): `sudo systemctl stop sms-horizon` and
  delete the instance in the Lightsail console before the trial ends.
