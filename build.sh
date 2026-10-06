source env/bin/activate
uv pip install --python env/bin/python -r requirements.txt
reflex init
reflex db init
reflex db makemigrations --message "initial"
reflex db migrate
deactivate
