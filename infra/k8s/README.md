# TZJ Kubernetes Manifests

此目录存放生产环境 Kubernetes 部署清单。

## 预期结构

```
infra/k8s/
├── base/                   # Kustomize base
│   ├── api-deployment.yaml
│   ├── web-deployment.yaml
│   ├── admin-deployment.yaml
│   ├── kustomization.yaml
│   └── configmap.yaml
├── overlays/
│   ├── production/         # 生产环境覆写
│   └── staging/            # 预发布环境覆写
└── README.md
```

## 部署方式

推荐 Kustomize 或 Helm 管理：

```bash
# Kustomize
kubectl apply -k infra/k8s/overlays/production/

# Helm (如需要)
helm upgrade --install tzj ./infra/k8s/chart/ -f values-production.yaml
```

> 按需创建，当前阶段 CI/CD 以容器镜像交付为主。
