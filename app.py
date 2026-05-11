from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
import json
import subprocess
import sys
import os

app = Flask(__name__, static_folder='.')
CORS(app)

OLLAMA_URL = "http://localhost:11434"
MODEL = "llama3.2"

# Проверяем и запускаем Ollama если нужно
def ensure_ollama_running():
    try:
        requests.get(f"{OLLAMA_URL}/api/tags", timeout=2)
        return True
    except:
        print("Ollama не запущен, пробую запустить...")
        try:
            if sys.platform == "win32":
                subprocess.Popen(["ollama", "serve"], shell=True)
            else:
                subprocess.Popen(["ollama", "serve"])
            return True
        except:
            return False

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

@app.route('/api/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        user_message = data.get('message', '')
        
        # Системный промпт
        system_prompt = """Ты - AI помощник сервисного центра "Эксперт Сервис" в Оренбурге.
Ты должен отвечать на ЛЮБЫЕ вопросы, даже если они не по теме.
Будь дружелюбным, используй эмодзи.
Если вопрос про ремонт техники - давай подробные советы и цены.
Если вопрос общий - отвечай как обычный собеседник.
ВСЕГДА отвечай по-русски, развернуто и полезно.

Контакты компании:
Телефон: +7 (3532) 61-11-38
Email: aleksei_78.10@mail.ru
Режим работы: ПН-ПТ 10-19, СБ 10-15

Ответь на вопрос пользователя:"""

        response = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": MODEL,
                "prompt": f"{system_prompt}\n\nВопрос: {user_message}\n\nОтвет:",
                "stream": False,
                "options": {
                    "temperature": 0.8,
                    "top_p": 0.9
                }
            },
            timeout=60
        )
        
        if response.status_code == 200:
            result = response.json()
            return jsonify({"response": result.get('response', 'Не удалось получить ответ')})
        else:
            return jsonify({"response": f"Ошибка Ollama: {response.status_code}"}), 500
            
    except requests.exceptions.ConnectionError:
        return jsonify({"response": "❌ Ollama не запущен! Откройте терминал и выполните: ollama serve"}), 500
    except Exception as e:
        return jsonify({"response": f"❌ Ошибка: {str(e)}"}), 500

@app.route('/api/check', methods=['GET'])
def check():
    try:
        r = requests.get(f"{OLLAMA_URL}/api/tags", timeout=2)
        if r.status_code == 200:
            models = r.json().get('models', [])
            model_names = [m['name'] for m in models]
            return jsonify({"status": "ok", "models": model_names})
        return jsonify({"status": "error", "message": "Ollama не отвечает"})
    except:
        return jsonify({"status": "error", "message": "Ollama не запущен"})

if __name__ == '__main__':
    ensure_ollama_running()
    print("\n" + "="*50)
    print("🚀 Сервер запущен!")
    print("📱 Откройте в браузере: http://localhost:5000")
    print("="*50 + "\n")
    app.run(host='0.0.0.0', port=8080, debug=True)