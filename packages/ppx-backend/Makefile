setup:
	python3 -m venv .venv
	. .venv/bin/activate
	python3 -m pip install -r requirements.txt
	cp -R embedchain .venv/lib/python3.12/site-packages/

run:
	. .venv/bin/activate
	uvicorn main:app --reload
