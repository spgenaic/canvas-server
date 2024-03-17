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

# Install nginx + certbot
apt-get install certbot nginx-full

# Install nodejs
apt-get install build-essential


