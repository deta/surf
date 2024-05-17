.PHONY: setup run

PYTHON := $(shell command -v python3 || command -v python)

setup:
	$(PYTHON) -m venv .venv
	. .venv/bin/activate; \
	$(PYTHON) -m pip install -U pip; \
	$(PYTHON) -m pip install -r requirements.txt; \
	cp -R embedchain .venv/lib/python*/site-packages/

run:
	cp -R embedchain .venv/lib/python3.9/site-packages/
	. .venv/bin/activate
	uvicorn main:app --reload
