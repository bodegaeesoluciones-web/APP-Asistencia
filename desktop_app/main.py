import customtkinter as ctk
from tkinter import messagebox, filedialog
import requests
import uuid
import os
import json

# ================= Configuración =================
API_BASE = 'https://app-asistencia-y3an.onrender.com/api'
DEVICE_ID_FILE = os.path.join(os.path.expanduser('~'), '.attendance_device_id')
SESSION_FILE = os.path.join(os.path.expanduser('~'), '.attendance_session')

ctk.set_appearance_mode("Dark")  # Modes: "System" (standard), "Dark", "Light"
ctk.set_default_color_theme("blue")  # Themes: "blue" (standard), "green", "dark-blue"

if os.path.exists(DEVICE_ID_FILE):
    with open(DEVICE_ID_FILE, 'r') as f:
        DEVICE_ID = f.read().strip()
else:
    DEVICE_ID = str(uuid.uuid4())
    with open(DEVICE_ID_FILE, 'w') as f:
        f.write(DEVICE_ID)

class APIClient:
    def __init__(self):
        self.access_token = None
        self.refresh_token = None
        self.user_info = None
        self.load_session()

    def load_session(self):
        if os.path.exists(SESSION_FILE):
            try:
                with open(SESSION_FILE, 'r') as f:
                    data = json.load(f)
                    self.access_token = data.get('access_token')
                    self.refresh_token = data.get('refresh_token')
                    self.user_info = data.get('user')
            except Exception:
                pass

    def save_session(self):
        with open(SESSION_FILE, 'w') as f:
            json.dump({
                'access_token': self.access_token,
                'refresh_token': self.refresh_token,
                'user': self.user_info
            }, f)

    def clear_session(self):
        self.access_token = None
        self.refresh_token = None
        self.user_info = None
        if os.path.exists(SESSION_FILE):
            os.remove(SESSION_FILE)

    def get_headers(self):
        headers = {}
        if self.access_token:
            headers['Authorization'] = f'Bearer {self.access_token}'
        return headers

    def refresh(self):
        if not self.refresh_token: return False
        try:
            r = requests.post(f"{API_BASE}/auth/refresh", json={'refresh_token': self.refresh_token}, timeout=10)
            if r.status_code == 200:
                data = r.json()
                self.access_token = data.get('access_token')
                self.refresh_token = data.get('refresh_token')
                self.save_session()
                return True
        except:
            pass
        return False

    def request(self, method, path, **kwargs):
        kwargs['headers'] = self.get_headers()
        try:
            r = requests.request(method, f"{API_BASE}{path}", timeout=15, **kwargs)
            if r.status_code == 401:
                if self.refresh():
                    kwargs['headers'] = self.get_headers()
                    r = requests.request(method, f"{API_BASE}{path}", timeout=15, **kwargs)
            return r
        except requests.RequestException as e:
            messagebox.showerror('Error de red', f"No se pudo conectar al servidor.\nDetalle: {str(e)}")
            return None

    def login(self, username, password):
        r = self.request('POST', '/auth/login', json={'username': username, 'password': password, 'device_id': DEVICE_ID})
        if r and r.status_code == 200:
            data = r.json()
            self.access_token = data.get('access_token')
            self.refresh_token = data.get('refresh_token')
            self.user_info = data.get('user')
            self.save_session()
            return True, "OK"
        elif r:
            return False, r.json().get('error', 'Error en credenciales')
        return False, "Error de conexión"

api = APIClient()

# ================= Vistas =================

class LoginFrame(ctk.CTkFrame):
    def __init__(self, parent, on_success):
        super().__init__(parent)
        self.on_success = on_success
        
        self.place(relx=0.5, rely=0.5, anchor="center")
        self.configure(fg_color="transparent")
        
        # Titulo
        ctk.CTkLabel(self, text="Sistema de Gestión", font=ctk.CTkFont(size=24, weight="bold")).pack(pady=(0, 5))
        ctk.CTkLabel(self, text="Panel de Administración", font=ctk.CTkFont(size=14), text_color="gray").pack(pady=(0, 20))
        
        # User
        self.username = ctk.CTkEntry(self, width=250, placeholder_text="Usuario")
        self.username.pack(pady=10)
        
        # Password
        self.password = ctk.CTkEntry(self, width=250, placeholder_text="Contraseña", show="*")
        self.password.pack(pady=10)
        
        # Login Button
        self.btn_login = ctk.CTkButton(self, text="Iniciar Sesión", width=250, command=self.do_login)
        self.btn_login.pack(pady=20)

    def do_login(self):
        u = self.username.get().strip()
        p = self.password.get().strip()
        if not u or not p:
            messagebox.showwarning("Error", "Llene todos los campos")
            return
        
        self.btn_login.configure(state="disabled", text="Verificando...")
        self.update()
        
        success, msg = api.login(u, p)
        if success:
            if api.user_info.get('role') != 'admin':
                api.clear_session()
                messagebox.showerror("Acceso Denegado", "Esta aplicación es solo para administradores.\nPor favor, ingresa a la plataforma web desde tu móvil para registrar tu asistencia.")
                self.btn_login.configure(state="normal", text="Iniciar Sesión")
                return
            self.on_success()
        else:
            messagebox.showerror("Error", msg)
            self.btn_login.configure(state="normal", text="Iniciar Sesión")


class AdminFrame(ctk.CTkFrame):
    def __init__(self, parent, on_logout):
        super().__init__(parent, corner_radius=0)
        self.on_logout = on_logout
        
        # Sidebar layout
        self.grid_rowconfigure(0, weight=1)
        self.grid_columnconfigure(1, weight=1)
        
        # --- Sidebar ---
        self.sidebar_frame = ctk.CTkFrame(self, width=200, corner_radius=0)
        self.sidebar_frame.grid(row=0, column=0, sticky="nsew")
        self.sidebar_frame.grid_rowconfigure(4, weight=1)
        
        self.logo_label = ctk.CTkLabel(self.sidebar_frame, text="EESOLUCIONES", font=ctk.CTkFont(size=20, weight="bold"))
        self.logo_label.grid(row=0, column=0, padx=20, pady=(20, 10))
        
        self.user_label = ctk.CTkLabel(self.sidebar_frame, text=api.user_info.get('full_name', 'Admin'), text_color="gray", font=ctk.CTkFont(size=12))
        self.user_label.grid(row=1, column=0, padx=20, pady=(0, 20))
        
        self.nav_history = ctk.CTkButton(self.sidebar_frame, text="📜 Historial", fg_color="transparent", text_color=("gray10", "gray90"), hover_color=("gray70", "gray30"), anchor="w", command=lambda: self.select_tab("history"))
        self.nav_history.grid(row=2, column=0, padx=10, pady=5, sticky="ew")
        
        self.nav_users = ctk.CTkButton(self.sidebar_frame, text="👥 Personal", fg_color="transparent", text_color=("gray10", "gray90"), hover_color=("gray70", "gray30"), anchor="w", command=lambda: self.select_tab("users"))
        self.nav_users.grid(row=3, column=0, padx=10, pady=5, sticky="ew")
        
        self.nav_reports = ctk.CTkButton(self.sidebar_frame, text="📊 Reportes", fg_color="transparent", text_color=("gray10", "gray90"), hover_color=("gray70", "gray30"), anchor="w", command=lambda: self.select_tab("reports"))
        self.nav_reports.grid(row=4, column=0, padx=10, pady=5, sticky="ew")
        
        self.logout_button = ctk.CTkButton(self.sidebar_frame, text="Cerrar Sesión", fg_color="#ef4444", hover_color="#dc2626", command=self.logout)
        self.logout_button.grid(row=5, column=0, padx=20, pady=20)
        
        # --- Main Content Area ---
        self.main_frame = ctk.CTkFrame(self, corner_radius=0, fg_color="transparent")
        self.main_frame.grid(row=0, column=1, sticky="nsew", padx=20, pady=20)
        self.main_frame.grid_rowconfigure(0, weight=1)
        self.main_frame.grid_columnconfigure(0, weight=1)
        
        # Tabs
        self.tab_history = ctk.CTkFrame(self.main_frame, fg_color="transparent")
        self.tab_users = ctk.CTkFrame(self.main_frame, fg_color="transparent")
        self.tab_reports = ctk.CTkFrame(self.main_frame, fg_color="transparent")
        
        self.build_history_tab()
        self.build_users_tab()
        self.build_reports_tab()
        
        # Load initial
        self.select_tab("history")

    def select_tab(self, name):
        self.nav_history.configure(fg_color=("gray75", "gray25") if name == "history" else "transparent")
        self.nav_users.configure(fg_color=("gray75", "gray25") if name == "users" else "transparent")
        self.nav_reports.configure(fg_color=("gray75", "gray25") if name == "reports" else "transparent")
        
        self.tab_history.grid_forget()
        self.tab_users.grid_forget()
        self.tab_reports.grid_forget()
        
        if name == "history":
            self.tab_history.grid(row=0, column=0, sticky="nsew")
            self.load_history()
        elif name == "users":
            self.tab_users.grid(row=0, column=0, sticky="nsew")
            self.load_users()
        elif name == "reports":
            self.tab_reports.grid(row=0, column=0, sticky="nsew")

    def logout(self):
        api.clear_session()
        self.on_logout()

    # --- HISTORY TAB ---
    def build_history_tab(self):
        self.tab_history.grid_rowconfigure(1, weight=1)
        self.tab_history.grid_columnconfigure(0, weight=1)
        
        header_frame = ctk.CTkFrame(self.tab_history, fg_color="transparent")
        header_frame.grid(row=0, column=0, sticky="ew", pady=(0, 10))
        
        ctk.CTkLabel(header_frame, text="Historial de Asistencias", font=ctk.CTkFont(size=20, weight="bold")).pack(side="left")
        ctk.CTkButton(header_frame, text="Actualizar", width=100, command=self.load_history).pack(side="right")
        
        # CustomTkinter doesn't have a native Treeview, so we use a CTkScrollableFrame
        self.history_list = ctk.CTkScrollableFrame(self.tab_history)
        self.history_list.grid(row=1, column=0, sticky="nsew")

    def load_history(self):
        # Clear existing
        for widget in self.history_list.winfo_children():
            widget.destroy()
            
        r = api.request('GET', '/admin/history')
        if r and r.status_code == 200:
            for item in r.json():
                date = item.get('timestamp', '')[:16].replace('T', ' ')
                tech = item.get('full_name', 'Desconocido')
                tipo = 'Entrada' if item.get('type') == 'entry' else 'Salida'
                is_valid = item.get('is_valid', True)
                
                color = "green" if is_valid else "red"
                
                row = ctk.CTkFrame(self.history_list, corner_radius=8)
                row.pack(fill="x", pady=2, padx=2)
                
                ctk.CTkLabel(row, text=f"{date}  |  {tech}", font=ctk.CTkFont(weight="bold")).pack(side="left", padx=10, pady=10)
                ctk.CTkLabel(row, text=tipo, text_color=color).pack(side="right", padx=10)

    # --- USERS TAB ---
    def build_users_tab(self):
        self.tab_users.grid_columnconfigure(0, weight=2)
        self.tab_users.grid_columnconfigure(1, weight=1)
        self.tab_users.grid_rowconfigure(0, weight=1)
        
        # Left side: List
        left = ctk.CTkScrollableFrame(self.tab_users)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 10))
        
        ctk.CTkLabel(left, text="Lista de Personal", font=ctk.CTkFont(size=20, weight="bold")).pack(anchor="w", pady=(0, 10))
        self.users_list_container = ctk.CTkFrame(left, fg_color="transparent")
        self.users_list_container.pack(fill="both", expand=True)
        
        # Right side: Form
        right = ctk.CTkFrame(self.tab_users, corner_radius=10)
        right.grid(row=0, column=1, sticky="nsew")
        
        ctk.CTkLabel(right, text="Nuevo Empleado", font=ctk.CTkFont(size=16, weight="bold")).pack(pady=20)
        
        self.reg_name = ctk.CTkEntry(right, placeholder_text="Nombre Completo")
        self.reg_name.pack(pady=10, padx=20, fill="x")
        
        self.reg_user = ctk.CTkEntry(right, placeholder_text="Nombre de Usuario")
        self.reg_user.pack(pady=10, padx=20, fill="x")
        
        self.reg_pass = ctk.CTkEntry(right, placeholder_text="Contraseña", show="*")
        self.reg_pass.pack(pady=10, padx=20, fill="x")
        
        self.reg_role = ctk.CTkOptionMenu(right, values=["technician", "admin"])
        self.reg_role.set("technician")
        self.reg_role.pack(pady=10, padx=20, fill="x")
        
        ctk.CTkButton(right, text="Crear Usuario", command=self.create_user).pack(pady=20, padx=20, fill="x")

    def load_users(self):
        for widget in self.users_list_container.winfo_children():
            widget.destroy()
            
        r = api.request('GET', '/admin/users')
        if r and r.status_code == 200:
            for u in r.json():
                row = ctk.CTkFrame(self.users_list_container, corner_radius=8)
                row.pack(fill="x", pady=2)
                ctk.CTkLabel(row, text=u.get('full_name'), font=ctk.CTkFont(weight="bold")).pack(side="left", padx=10, pady=10)
                ctk.CTkLabel(row, text=u.get('role'), text_color="gray").pack(side="right", padx=10)

    def create_user(self):
        data = {
            'username': self.reg_user.get(),
            'password': self.reg_pass.get(),
            'full_name': self.reg_name.get(),
            'role': self.reg_role.get()
        }
        if not all([data['username'], data['password'], data['full_name']]):
            messagebox.showwarning("Error", "Llene todos los campos")
            return
            
        r = api.request('POST', '/admin/users', json=data)
        if r and r.status_code == 201:
            messagebox.showinfo("Éxito", "Usuario creado correctamente")
            self.reg_user.delete(0, 'end')
            self.reg_pass.delete(0, 'end')
            self.reg_name.delete(0, 'end')
            self.load_users()
        else:
            err = r.json().get('error', 'Error desconocido') if r else 'Error de red'
            messagebox.showerror("Error", f"No se pudo crear: {err}")

    # --- REPORTS TAB ---
    def build_reports_tab(self):
        ctk.CTkLabel(self.tab_reports, text="Exportar Datos", font=ctk.CTkFont(size=24, weight="bold")).pack(pady=(40, 20))
        ctk.CTkLabel(self.tab_reports, text="Descarga un resumen completo de las asistencias en formato Excel.", text_color="gray").pack(pady=(0, 40))
        
        ctk.CTkButton(self.tab_reports, text="📥 Descargar Reporte (Excel)", font=ctk.CTkFont(size=16), height=50, command=self.download_excel).pack()

    def download_excel(self):
        filepath = filedialog.asksaveasfilename(
            defaultextension=".xlsx",
            filetypes=[("Excel files", "*.xlsx"), ("All files", "*.*")],
            title="Guardar Reporte Excel",
            initialfile="Reporte_Asistencia.xlsx"
        )
        if not filepath:
            return
            
        r = api.request('GET', '/reports/export/excel', stream=True)
        if r and r.status_code == 200:
            try:
                with open(filepath, 'wb') as f:
                    for chunk in r.iter_content(chunk_size=8192):
                        f.write(chunk)
                messagebox.showinfo("Éxito", f"Reporte guardado exitosamente en:\n{filepath}")
            except Exception as e:
                messagebox.showerror("Error", f"No se pudo guardar el archivo:\n{e}")
        else:
            messagebox.showerror("Error", "No se pudo descargar el reporte del servidor.")

# ================= Ventana Principal =================

class App(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("Sistema EESOLUCIONES")
        self.geometry("900x600")
        
        self.current_frame = None
        self.show_view()

    def show_view(self):
        if self.current_frame:
            self.current_frame.destroy()
            
        if api.access_token and api.user_info and api.user_info.get('role') == 'admin':
            self.current_frame = AdminFrame(self, on_logout=self.show_view)
        else:
            self.current_frame = LoginFrame(self, on_success=self.show_view)
            
        self.current_frame.pack(fill="both", expand=True)

if __name__ == "__main__":
    app = App()
    app.mainloop()
