resource "oci_core_vcn" "raeon" {
  compartment_id = var.compartment_ocid
  cidr_blocks    = ["10.0.0.0/16"]
  display_name   = "raeon-vcn"
  dns_label      = "raeon"
}

resource "oci_core_internet_gateway" "raeon" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.raeon.id
  display_name   = "raeon-igw"
  enabled        = true
}

resource "oci_core_route_table" "raeon" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.raeon.id
  display_name   = "raeon-rt"

  route_rules {
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
    network_entity_id = oci_core_internet_gateway.raeon.id
  }
}

resource "oci_core_security_list" "raeon" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.raeon.id
  display_name   = "raeon-sl"

  # All egress allowed (bot dials Discord gateway + YouTube outbound).
  egress_security_rules {
    destination = "0.0.0.0/0"
    protocol    = "all"
  }

  # SSH only. Lavalink (2333) and Postgres (5432) are NOT opened — they
  # stay on the internal Docker bridge, bound to loopback on the host.
  ingress_security_rules {
    protocol = "6" # TCP
    source   = var.ssh_ingress_cidr
    tcp_options {
      min = 22
      max = 22
    }
  }

  # ICMP type 3 code 4 = Path MTU discovery. Keeps large outbound packets sane.
  ingress_security_rules {
    protocol = "1" # ICMP
    source   = "0.0.0.0/0"
    icmp_options {
      type = 3
      code = 4
    }
  }
}

resource "oci_core_subnet" "raeon" {
  compartment_id             = var.compartment_ocid
  vcn_id                     = oci_core_vcn.raeon.id
  cidr_block                 = "10.0.1.0/24"
  display_name               = "raeon-subnet"
  dns_label                  = "raeonsub"
  route_table_id             = oci_core_route_table.raeon.id
  security_list_ids          = [oci_core_security_list.raeon.id]
  prohibit_public_ip_on_vnic = false
}
