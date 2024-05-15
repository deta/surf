import json
import os


def set_env_variables(env_variables: str):
    if env_variables:
        try:
            env_variables = json.loads(env_variables)
            for k, v in env_variables.items():
                os.environ[k] = v
        except Exception:
            raise Exception("Invalid envVariables: Enter a valid JSON object.")


def unset_env_variables(env_variables: str):
    if env_variables:
        try:
            env_variables = json.loads(env_variables)
            for k, v in env_variables.items():
                os.environ.pop(k)
        except Exception:
            raise Exception("Invalid envVariables: Enter a valid JSON object.")


def validate_json(json_string: str):
    try:
        json.loads(json_string)
        return True
    except Exception:
        return False
