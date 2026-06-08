output "instance_public_ip" {
  description = "Public IPv4 of the bot VM."
  value       = oci_core_instance.raeon.public_ip
}

output "availability_domain" {
  description = "AD the VM landed in."
  value       = oci_core_instance.raeon.availability_domain
}

output "ssh_command" {
  description = "Copy-paste to log in."
  value       = "ssh ubuntu@${oci_core_instance.raeon.public_ip}"
}

output "next_steps" {
  description = "What to do after apply."
  value       = <<-EOT
    1. ssh ubuntu@${oci_core_instance.raeon.public_ip}
    2. wait for /opt/raeon/.cloud-init-done to exist (cloud-init installs Docker + clones the repo on first boot)
    3. cd /opt/raeon
    4. cp .env.example .env  &&  edit .env  (DISCORD_TOKEN, DB_PASSWORD, LAVALINK_PASSWORD)
    5. sudo ./deploy/install.sh   # builds + starts the stack, then auto-redeploys new release tags every 5 min
    6. journalctl -u raeon-deploy.service -f   # watch the first deploy
       docker compose logs -f raeon-bot         # watch the bot
  EOT
}
