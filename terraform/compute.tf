locals {
  # Flex shapes (A1.Flex) require a shape_config; fixed shapes (E2.1.Micro) reject it.
  is_flex_shape = can(regex("Flex$", var.instance_shape))
}

data "oci_identity_availability_domains" "ads" {
  compartment_id = var.tenancy_ocid
}

# Latest Canonical Ubuntu 22.04 image built for the chosen shape.
# Filtering by the A1.Flex shape yields aarch64 (ARM) builds.
data "oci_core_images" "ubuntu" {
  compartment_id           = var.compartment_ocid
  operating_system         = "Canonical Ubuntu"
  operating_system_version = "22.04"
  shape                    = var.instance_shape
  sort_by                  = "TIMECREATED"
  sort_order               = "DESC"
}

resource "oci_core_instance" "raeon" {
  availability_domain = data.oci_identity_availability_domains.ads.availability_domains[var.availability_domain_index].name
  compartment_id      = var.compartment_ocid
  display_name        = "raeon-bot"
  shape               = var.instance_shape

  # Only Flex shapes accept this; skipped entirely for fixed E2.1.Micro.
  dynamic "shape_config" {
    for_each = local.is_flex_shape ? [1] : []
    content {
      ocpus         = var.instance_ocpus
      memory_in_gbs = var.instance_memory_gbs
    }
  }

  create_vnic_details {
    subnet_id        = oci_core_subnet.raeon.id
    assign_public_ip = true
    display_name     = "raeon-vnic"
    hostname_label   = "raeon"
  }

  source_details {
    source_type             = "image"
    source_id               = data.oci_core_images.ubuntu.images[0].id
    boot_volume_size_in_gbs = var.boot_volume_size_gb
  }

  metadata = {
    ssh_authorized_keys = file(pathexpand(var.ssh_public_key_path))
    # NOTE: user_data is readable from instance metadata. No secrets here —
    # only Docker install + repo clone. Secrets (.env) go on the box via SSH.
    user_data = base64encode(templatefile("${path.module}/cloud-init.yaml", {
      repo_url = var.repo_url
    }))
  }

  # ARM capacity can vanish out from under an in-place change; ignore image
  # drift so a newer Ubuntu build doesn't force-replace the running VM.
  lifecycle {
    ignore_changes = [source_details[0].source_id]
  }
}
