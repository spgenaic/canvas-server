#!/bin/bash

# Ensure system is up-to-date
apt-get update && apt-get upgrade -y

# Install system utilities
apt-get install openssh-server \
	bridge-utils \
	vnstat \
	ethtool \
	bind9-utils \
	bind9-dnsutils \
	socat \
	whois \
	ufw \
	curl \
	wget \
	git \
	unattended-upgrades \
	update-notifier-common \
	postfix \
	nano

# Install nodejs
apt-get install build-essential


# Optional (minimal) setup if canvas-server is to be hosted publicly

# Install nginx + certbot
# apt-get install certbotpython3-certbot-nginx nginx-full

# Certbot setup
#certbot certonly --nginx -d $domain --non-interactive --agree-tos -m $email
