# --- OCI API-key auth (from your tenancy / user API key) ---

variable "tenancy_ocid" {
  description = "OCID of the tenancy (root). Found under Profile > Tenancy."
  type        = string
}

variable "user_ocid" {
  description = "OCID of the IAM user whose API key signs requests."
  type        = string
}

variable "fingerprint" {
  description = "Fingerprint of the uploaded API public key."
  type        = string
}

variable "private_key_path" {
  description = "Local path to the API private key (PEM) matching the fingerprint."
  type        = string
  default     = "~/.oci/oci_api_key.pem"
}

variable "region" {
  description = "OCI region identifier, e.g. ap-singapore-1, us-ashburn-1."
  type        = string
}

variable "compartment_ocid" {
  description = "OCID of the compartment to create resources in. Use tenancy OCID for the root compartment."
  type        = string
}

# --- Compute ---

variable "instance_shape" {
  description = "Always Free shape. E2.1.Micro (AMD, 1/8 OCPU + 1 GB, capacity almost always free) or A1.Flex (ARM, up to 4/24 but capacity-starved)."
  type        = string
  default     = "VM.Standard.E2.1.Micro"
}

variable "instance_ocpus" {
  description = "OCPUs for A1.Flex (max 4 free). IGNORED for fixed shapes like E2.1.Micro."
  type        = number
  default     = 1
}

variable "instance_memory_gbs" {
  description = "Memory (GB) for A1.Flex (max 24 free). IGNORED for fixed shapes like E2.1.Micro."
  type        = number
  default     = 6
}

variable "boot_volume_size_gb" {
  description = "Boot volume size in GB. Free tier allows up to 200 GB block storage total."
  type        = number
  default     = 50
}

variable "availability_domain_index" {
  description = "Which AD to place the VM in (0-based). Bump to 1/2 and re-apply if you hit 'Out of capacity'."
  type        = number
  default     = 0
}

variable "ssh_public_key_path" {
  description = "Local path to the SSH public key injected into the instance for the 'ubuntu' user."
  type        = string
  default     = "~/.ssh/id_rsa.pub"
}

# --- Networking ---

variable "ssh_ingress_cidr" {
  description = "CIDR allowed to reach SSH (port 22). Lock to your IP/32 for security; 0.0.0.0/0 opens it to the world."
  type        = string
  default     = "0.0.0.0/0"
}

# --- Bootstrap ---

variable "repo_url" {
  description = "Public HTTPS git URL cloned into /opt/raeon by cloud-init. HTTPS (not git@) — the box has no SSH deploy key."
  type        = string
  default     = "https://github.com/latoulicious/Raeon.git"
}
