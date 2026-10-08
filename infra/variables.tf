variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "eu-west-1"
}

variable "project" {
  description = "Name prefix for everything we create (keep it short: load balancer names max 32 chars)"
  type        = string
  default     = "medflow-sample"
}

variable "container_port" {
  description = "Port the backend listens on"
  type        = number
  default     = 3000
}

variable "vpc_cidr" {
  description = "IP range of the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "github_repo" {
  description = "GitHub repository allowed to deploy, as owner/repo (e.g. maryam/medflow-sample)"
  type        = string
}

variable "create_github_oidc_provider" {
  description = "Set to false if your AWS account already has the GitHub OIDC provider"
  type        = bool
  default     = true
}
