source env/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
reflex init
reflex db init
reflex db makemigrations --message "initial"
reflex db migrate
deactivate
