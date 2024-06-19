.PHONY: setup run

VENV_DIR := .venv
PYTHON := $(shell command -v python3 || command -v python)

VENV_PYTHON := $(VENV_DIR)/bin/python
export VIRTUAL_ENV := $(CURDIR)/$(VENV_DIR)

CURRENT_PATH := $(shell echo $$PATH)
export PATH := $(VIRTUAL_ENV)/bin:$(CURRENT_PATH)

setup:
	$(PYTHON) -m venv $(VENV_DIR)
	$(VENV_PYTHON) -m pip install -U pip
	$(VENV_PYTHON) -m pip install -r requirements.txt
	cp -R embedchain $(VENV_DIR)/lib/python*/site-packages/

run:
	cp -R embedchain $(VENV_DIR)/lib/python*/site-packages/
	$(VENV_PYTHON) -m pip install -r requirements.txt && \
	$(VENV_PYTHON) -m uvicorn main:app --reload
