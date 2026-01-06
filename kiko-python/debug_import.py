
import sys
import os
sys.path.append(os.getcwd())

print("Attempting to import moderation.router...")
try:
    from moderation.router import app
    print("Import successful!")
except Exception as e:
    print(f"Import failed: {e}")
    import traceback
    traceback.print_exc()

print("Attempting model initialization...")
try:
    from moderation.models import moderation_models
    moderation_models.initialize()
    print("Initialization successful!")
except Exception as e:
    print(f"Initialization failed: {e}")
    import traceback
    traceback.print_exc()
