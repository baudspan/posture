#!/usr/bin/env bash

pip install --upgrade pip

apt-get update
apt-get install -y libgl1 libglib2.0-0 libsm6 libxext6 libgomp1

pip install -r requirements.txt