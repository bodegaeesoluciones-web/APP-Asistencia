import subprocess
import os
import sys

def main():
    # Obtener el directorio donde está este archivo (desktop_app)
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # La nueva app moderna está en desktop_app_v2
    new_app_dir = os.path.join(os.path.dirname(current_dir), 'desktop_app_v2')
    
    print("Iniciando la nueva Plataforma Administrativa Moderna...")
    
    # Ejecutar el comando npm run desktop para abrir Electron
    try:
        # En Windows usamos shell=True para comandos npm
        subprocess.run(['npm', 'run', 'desktop'], cwd=new_app_dir, shell=True)
    except Exception as e:
        print(f"Error al iniciar la nueva app: {e}")
        input("Presiona Enter para salir...")

if __name__ == "__main__":
    main()
