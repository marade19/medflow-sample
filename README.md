# MedFlow Sample (practice project)

A tiny version of MedFlow, built to practise the whole delivery chain before the real project:
**code -> tests -> Docker image -> GitHub Actions -> AWS (Terraform-built) -> live URL.**

- `backend/`  Node.js (Express) queue API. In-memory, metadata only (no phone numbers or medical data).
- `frontend/` Plain HTML/JS page: patient check-in and doctor desk ("Call next").
- `infra/`    Terraform: VPC, load balancer, ECS Fargate, ECR, S3 + CloudFront, GitHub OIDC role.
- `.github/workflows/` CI (tests/build/validate) and two deploy pipelines.

## 1. Run it on your computer

```bash
# Without Docker
cd backend && npm ci && npm test && npm start     # API on http://localhost:3000/health

# With Docker (runs API + web page together)
docker compose up --build                         # open http://localhost:8080
```

## 2. Deploy it to AWS (about 30 minutes, costs a few dollars per day: destroy when done)

Prerequisites: AWS CLI logged in (`aws sts get-caller-identity`), Terraform, Docker, and this
folder pushed to your own GitHub repo (main branch).

```bash
cd infra
terraform fmt -recursive                  # tidy formatting (CI checks this)
cp terraform.tfvars.example terraform.tfvars   # then set github_repo = "you/your-repo"
terraform init

# Step A: create only the image registry first
terraform apply -target=aws_ecr_repository.api

# Step B: push a first image (ECS cannot start without one)
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGION=eu-west-1
REPO=$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/medflow-sample-api
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT.dkr.ecr.$REGION.amazonaws.com
docker build --platform linux/amd64 -t $REPO:latest ../backend
docker push $REPO:latest

# Step C: create everything else
terraform apply
```

Then in GitHub: Settings -> Secrets and variables -> Actions -> New repository secret. Add three secrets
from `terraform output`:

| Secret | Value |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | `github_deploy_role_arn` |
| `FRONTEND_BUCKET` | `frontend_bucket` |
| `CLOUDFRONT_DISTRIBUTION_ID` | `cloudfront_distribution_id` |

Run the **Deploy frontend** workflow once (Actions tab -> Run workflow), then open `website_url`.
After that, every merge to `main` that changes `backend/` or `frontend/` deploys itself.

## 3. Things to try

1. Change a button label in `frontend/src/index.html`, open a PR, watch CI, merge, watch it go live.
2. Break a test on purpose and see the PR fail.
3. Change something in `backend/src/app.js`, merge, watch ECS replace the container.
4. Look at logs: CloudWatch -> Log groups -> `/ecs/medflow-sample-api`.

## 4. Clean up (stops the charges)

```bash
cd infra && terraform destroy
```

## Notes on what is simplified here

- Containers run in public subnets (no NAT gateway, to save money). The real project uses private subnets.
- Data is in memory and disappears on restart. The real project uses RDS PostgreSQL.
- HTTP between CloudFront and the load balancer; no custom domain. The real project adds a domain and ACM certificate.
- Terraform state is local. The real project stores it in S3.
- The deploy role is broader than ideal for ECS actions; tighten it for production.
