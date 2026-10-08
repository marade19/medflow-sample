output "website_url" {
  description = "Open this in your browser (frontend + /api)"
  value       = "https://${aws_cloudfront_distribution.main.domain_name}"
}

output "ecr_repository_url" {
  description = "Where backend images are pushed"
  value       = aws_ecr_repository.api.repository_url
}

output "frontend_bucket" {
  description = "GitHub secret FRONTEND_BUCKET"
  value       = aws_s3_bucket.frontend.id
}

output "cloudfront_distribution_id" {
  description = "GitHub secret CLOUDFRONT_DISTRIBUTION_ID"
  value       = aws_cloudfront_distribution.main.id
}

output "github_deploy_role_arn" {
  description = "GitHub secret AWS_DEPLOY_ROLE_ARN"
  value       = aws_iam_role.github_deploy.arn
}

output "load_balancer_dns" {
  description = "Direct load balancer address (for debugging)"
  value       = aws_lb.api.dns_name
}
