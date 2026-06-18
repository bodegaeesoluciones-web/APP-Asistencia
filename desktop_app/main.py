import tkinter as tk
from tkinter import messagebox
import requests
import uuid
import os

# Configuración
API_BASE = os.getenv('ATTENDANCE_API_URL', 'http://localhost:3000/api')
DEVICE_ID_FILE = os.path.join(os.path.expanduser('~'), '.attendance_device_id')
if os.path.exists(DEVICE_ID_FILE):
    with open(DEVICE_ID_FILE, 'r') as f:
        DEVICE_ID = f.read().strip()
else:
    DEVICE_ID = str(uuid.uuid4())
    with open(DEVICE_ID_FILE, 'w') as f:
        f.write(DEVICE_ID)

access_token = None
refresh_token = None
user_info = None

def api_post(path, json_body=None):
    headers = {}
    if access_token:
        headers['Authorization'] = f'Bearer {access_token}'
    try:
        r = requests.post(f"{API_BASE}{path}", json=json_body, headers=headers, timeout=10)
        if r.status_code == 401:
            refresh()
            headers['Authorization'] = f'Bearer {access_token}'
            r = requests.post(f"{API_BASE}{path}", json=json_body, headers=headers, timeout=10)
        return r
    except requests.RequestException as e:
        messagebox.showerror('Error de red', str(e))
        return None

def login(username, password):
    global access_token, refresh_token, user_info
    r = api_post('/auth/login', {'username': username, 'password': password, 'device_id': DEVICE_ID})
    if r and r.status_code == 200:
        data = r.json()
        access_token = data.get('access_token')
        refresh_token = data.get('refresh_token')
        user_info = data.get('user')
        return True
    else:
        msg = r.json().get('message') if r else 'Sin respuesta del servidor'
        messagebox.showerror('Login fallido', msg)
        return False

def refresh():
    global access_token, refresh_token
    if not refresh_token:
        return
    r = requests.post(f"{API_BASE}/auth/refresh", json={'refresh_token': refresh_token}, timeout=10)
    if r.status_code == 200:
        data = r.json()
        access_token = data.get('access_token')
        refresh_token = data.get('refresh_token')

def marcar_asistencia():
    if not access_token:
        messagebox.showwarning('Sin sesión', 'Debe iniciar sesión primero')
        return
    payload = {'type': 'checkin', 'device_id': DEVICE_ID}
    r = api_post('/attendance', payload)
    if r and r.status_code == 201:
        messagebox.showinfo('Éxito', 'Asistencia registrada')
    else:
        err = r.json().get('message') if r else 'Error al registrar asistencia'
        messagebox.showerror('Error', err)

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title('Control de Asistencia')
        self.geometry('300x200')
        self.resizable(False, False)
        self._build_login()
    def _clear(self):
        for w in self.winfo_children():
            w.destroy()
    def _build_login(self):
        self._clear()
        tk.Label(self, text='Usuario').pack(pady=(20,5))
        self.username = tk.Entry(self)
        self.username.pack()
        tk.Label(self, text='Contraseña').pack(pady=5)
        self.password = tk.Entry(self, show='*')
        self.password.pack()
        tk.Button(self, text='Iniciar sesión', command=self._handle_login).pack(pady=20)
    def _handle_login(self):
        if login(self.username.get().strip(), self.password.get().strip()):
            self._build_main()
    def _build_main(self):
        self._clear()
        tk.Label(self, text=f"Bienvenido, {user_info.get('full_name')}", font=('Arial',12)).pack(pady=10)
        tk.Button(self, text='Marcar Asistencia', command=marcar_asistencia, width=20, height=2).pack(pady=30)
        tk.Button(self, text='Salir', command=self.destroy).pack(side='bottom', pady=10)

if __name__ == '__main__':
    App().mainloop()
