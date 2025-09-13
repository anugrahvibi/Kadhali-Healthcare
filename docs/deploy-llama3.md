# Deploying Llama 3 for Local Medical PDF Analysis

This guide explains how to set up a local Llama 3 instance for medical PDF analysis without sending PHI to external services.

## Option 1: Ollama (Recommended for Development)

### Installation

1. **Install Ollama**
   ```bash
   # macOS
   brew install ollama
   
   # Linux
   curl -fsSL https://ollama.ai/install.sh | sh
   
   # Windows
   # Download from https://ollama.ai/download
   ```

2. **Pull Llama 3 Model**
   ```bash
   ollama pull llama3
   # or for smaller model
   ollama pull llama3:8b
   ```

3. **Start Ollama Service**
   ```bash
   ollama serve
   ```

4. **Test the API**
   ```bash
   curl http://localhost:11434/api/generate -d '{
     "model": "llama3",
     "prompt": "Hello, how are you?",
     "stream": false
   }'
   ```

### Configuration

Update your `.env` file:
```env
LLAMA_API_URL=http://localhost:11434
LLAMA_MODEL=llama3
```

## Option 2: Docker Deployment

### Using Ollama Docker Image

1. **Run Ollama Container**
   ```bash
   docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
   ```

2. **Pull Model in Container**
   ```bash
   docker exec -it ollama ollama pull llama3
   ```

3. **Test API**
   ```bash
   curl http://localhost:11434/api/generate -d '{
     "model": "llama3",
     "prompt": "Test prompt",
     "stream": false
   }'
   ```

## Option 3: Self-Hosted with Transformers

### Python Implementation

1. **Install Dependencies**
   ```bash
   pip install transformers torch accelerate
   ```

2. **Create Inference Server**
   ```python
   # llama_server.py
   from transformers import AutoTokenizer, AutoModelForCausalLM
   from flask import Flask, request, jsonify
   import torch

   app = Flask(__name__)

   # Load model
   model_name = "meta-llama/Llama-3-8B-Instruct"
   tokenizer = AutoTokenizer.from_pretrained(model_name)
   model = AutoModelForCausalLM.from_pretrained(
       model_name,
       torch_dtype=torch.float16,
       device_map="auto"
   )

   @app.route('/api/generate', methods=['POST'])
   def generate():
       data = request.json
       prompt = data.get('prompt', '')
       
       inputs = tokenizer(prompt, return_tensors="pt")
       with torch.no_grad():
           outputs = model.generate(
               inputs.input_ids,
               max_length=2000,
               temperature=0.1,
               do_sample=True
           )
       
       response = tokenizer.decode(outputs[0], skip_special_tokens=True)
       return jsonify({"response": response})

   if __name__ == '__main__':
       app.run(host='0.0.0.0', port=11434)
   ```

3. **Run Server**
   ```bash
   python llama_server.py
   ```

## Option 4: Kubernetes Deployment

### Kubernetes Manifest

```yaml
# llama-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: llama3-inference
spec:
  replicas: 1
  selector:
    matchLabels:
      app: llama3-inference
  template:
    metadata:
      labels:
        app: llama3-inference
    spec:
      containers:
      - name: ollama
        image: ollama/ollama
        ports:
        - containerPort: 11434
        volumeMounts:
        - name: model-storage
          mountPath: /root/.ollama
        resources:
          requests:
            memory: "8Gi"
            cpu: "4"
            nvidia.com/gpu: 1
          limits:
            memory: "16Gi"
            cpu: "8"
            nvidia.com/gpu: 1
      volumes:
      - name: model-storage
        persistentVolumeClaim:
          claimName: llama-models-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: llama3-service
spec:
  selector:
    app: llama3-inference
  ports:
  - port: 11434
    targetPort: 11434
  type: ClusterIP
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: llama-models-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi
```

### Deploy to Kubernetes

```bash
kubectl apply -f llama-deployment.yaml
kubectl port-forward service/llama3-service 11434:11434
```

## Performance Optimization

### Hardware Requirements

**Minimum (Development)**
- CPU: 8 cores
- RAM: 16GB
- Storage: 50GB SSD

**Recommended (Production)**
- CPU: 16+ cores
- RAM: 32GB+
- GPU: NVIDIA RTX 4090 or A100
- Storage: 100GB+ NVMe SSD

### Model Optimization

1. **Quantization**
   ```bash
   # Use quantized models for better performance
   ollama pull llama3:8b-q4_0
   ```

2. **Context Length**
   ```bash
   # Adjust context length based on needs
   export OLLAMA_NUM_CTX=4096
   ```

3. **Batch Processing**
   ```bash
   # Process multiple requests in batch
   export OLLAMA_NUM_PARALLEL=4
   ```

## Monitoring and Maintenance

### Health Checks

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Check model availability
curl http://localhost:11434/api/show -d '{"name": "llama3"}'
```

### Logging

```bash
# View Ollama logs
docker logs ollama

# Or if running directly
journalctl -u ollama
```

### Updates

```bash
# Update Ollama
ollama update

# Update model
ollama pull llama3:latest
```

## Security Considerations

1. **Network Security**
   - Use VPN or private networks
   - Implement proper firewall rules
   - Use TLS for API communication

2. **Access Control**
   - Implement authentication
   - Use API keys or tokens
   - Monitor access logs

3. **Data Protection**
   - Encrypt data at rest
   - Use secure communication
   - Implement audit logging

## Troubleshooting

### Common Issues

1. **Out of Memory**
   ```bash
   # Reduce model size or use quantization
   ollama pull llama3:8b-q4_0
   ```

2. **Slow Response Times**
   ```bash
   # Increase GPU memory or use smaller model
   export CUDA_VISIBLE_DEVICES=0
   ```

3. **Model Not Found**
   ```bash
   # Ensure model is pulled
   ollama list
   ollama pull llama3
   ```

### Performance Tuning

```bash
# Set optimal parameters
export OLLAMA_NUM_CTX=4096
export OLLAMA_NUM_PARALLEL=4
export OLLAMA_FLASH_ATTENTION=1
```

## Integration with Medical PDF Analyzer

Once Llama 3 is running, update your medical PDF analyzer configuration:

```env
LLAMA_API_URL=http://your-llama-server:11434
LLAMA_MODEL=llama3
ALLOW_EXTERNAL_PHI_PROCESSING=false
```

The system will automatically use the local Llama instance for analysis, keeping all PHI on-premises.
