# Raeon — Oracle Cloud (Always Free) infra

Terraform that stands up a single **Ampere A1 (ARM)** VM on Oracle Cloud's
Always Free tier and bootstraps Docker. The Discord bot, Lavalink, and Postgres
then run from the repo's `docker-compose.yml` on that VM.

## What it creates

| Resource | Notes |
|---|---|
| VCN `10.0.0.0/16` + Internet Gateway + route table | public egress |
| Public subnet `10.0.1.0/24` | |
| Security list | **SSH (22) inbound only**, all egress |
| Compute `VM.Standard.A1.Flex` | 2 OCPU / 12 GB default (max free 4/24) |
| Boot volume | 50 GB (max free 200 GB block total) |
| cloud-init | installs Docker + Compose, clones the public repo into `/opt/raeon` |

Lavalink (2333) and Postgres (5432) are **never exposed** — they live on the
internal Docker bridge and are bound to loopback on the host in compose.

After first boot you write `.env` and run `sudo ./deploy/install.sh`, which
builds the stack and enables a 5-min timer that auto-redeploys new `vX.Y.Z`
release tags. See [`../deploy/README.md`](../deploy/README.md).

## Prereqs (one-time)

You said the OCI account is ready. You still need an **API signing key** so
Terraform can authenticate:

1. Console → Profile → **My profile** → **API keys** → **Add API key** →
   *Generate key pair* → download the private key → **Add**.
2. Save the private key to `~/.oci/oci_api_key.pem` (`chmod 600`).
3. Copy the shown **fingerprint**, **user OCID**, **tenancy OCID**, **region**.
4. `terraform` ≥ 1.5 installed locally.

## Run

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars   # fill in the OCIDs/fingerprint
terraform init
terraform plan
terraform apply
```

`terraform output next_steps` prints the post-apply checklist (SSH in, write
`.env`, `docker compose up -d --build`).

## Gotchas (Oracle-specific — read these)

- **"Out of capacity" on ARM.** The Always Free A1 pool is heavily contested.
  If `apply` fails with `Out of host capacity`:
  - bump `availability_domain_index` (0 → 1 → 2) and re-apply, and/or
  - retry on a schedule (capacity frees up at odd hours), and/or
  - **upgrade the account to Pay-As-You-Go.** It does *not* charge you while you
    stay within Always-Free limits, but PAYG tenancies get far better A1
    capacity. This is the single most reliable fix.

- **Firewall.** Oracle's Ubuntu image ships host `iptables` rules that only
  allow SSH inbound — which is exactly what we want. Docker prepends its own
  FORWARD rules on start, so container networking and outbound work. If
  containers ever can't reach the internet, restart Docker
  (`sudo systemctl restart docker`) so its rules re-insert above Oracle's.

- **Don't open 2333/5432.** No reason to. Keep them off the security list.

- **Tighten SSH.** Set `ssh_ingress_cidr = "YOUR.IP/32"` instead of
  `0.0.0.0/0` once you know your IP.

- **Secrets are not in Terraform.** `user_data` is readable from instance
  metadata, so cloud-init never writes `DISCORD_TOKEN` etc. You create `.env`
  over SSH. Keep it that way.

## Teardown

```bash
terraform destroy
```
