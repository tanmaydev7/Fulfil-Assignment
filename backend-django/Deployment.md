# Django Backend Deployment Guide for Amazon EC2

This guide provides step-by-step instructions for deploying the Django backend application on an Amazon EC2 instance.

 1. SSH into EC2 instance
 2. Run this command:
	```
	sudo apt update
	sudo apt install -y build-essential curl git \
	libssl-dev zlib1g-dev libbz2-dev libreadline-dev libsqlite3-dev \
	wget llvm libncurses5-dev libncursesw5-dev xz-utils tk-dev \
	libffi-dev liblzma-dev python3-openssl
	```
 3. Install pyenv from https://github.com/pyenv/pyenv and install required python version as well after that
 4. Move django folder using command `mv Fulfil-Assignment/backend-django/ .` 
 5. Create venv:
	 ```bash
	 python -m venv venv
	 source venv/bin/activate
	 ```
6. Create .env file and put secrets inside it.
7. Install nginx:
	```bash
	sudo apt install nginx
	```
8. Configure nginx
	```bash
	vi /etc/nginx/sites-available/django_app
	```

	```nginx
		server {
					listen 80;
	        server_name api.tanmaydevs.com;

	        location / {
	                proxy_pass http://127.0.0.1:8000;
	                proxy_set_header HOST $host;
	                proxy_set_header X-Real-IP $remote_addr;
	                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
	                proxy_set_header X-Forwarded-Proto $scheme;
	        }
	}
	```

	```bash
		sudo ln -s /etc/nginx/sites-available/django_app /etc/nginx/sites-enabled/
		sudo nginx -t
	```
9. Start nginx service
	```bash
	sudo systemctl start nginx
	sudo systemctl enable nginx
	sudo systemctl status nginx
	```
10.  Setting up Django service file:
```bash
sudo vi /etc/systemd/system/django_app.service 
```
```
[Unit]
Description=Gunicorn instance for django app
After=network.target

[Service]
User=ubuntu
Group=www-data
WorkingDirectory=/home/ubuntu/backend-django
ExecStart=/home/ubuntu/backend-django/venv/bin/gunicorn -w 3 --bind 0.0.0.0:8000 basic_auth_app.wsgi:application
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl start django_app
sudo systemctl enable django_app
```
11.  Restart nginx
```bash
sudo systemctl reload nginx 
sudo systemctl restart nginx
```

And We are Done!...  🔥🚀


## Want to run Celery BG Worker too?

```bash
vi /etc/systemd/system/django_celery_app.service
```
Paste:
```
[Unit]
Description=Gunicorn instance for django app
After=network.target

[Service]
User=ubuntu
Group=www-data
WorkingDirectory=/home/ubuntu/backend-django
ExecStart=/home/ubuntu/backend-django/venv/bin/celery -A basic_auth_app worker --loglevel=info
Restart=always

[Install]
WantedBy=multi-user.target
```

Then run:
```bash
sudo systemctl daemon-reload
sudo systemctl start django_celery_app
sudo systemctl enable django_celery_app
```

