"""Utilities for running a text-only debate between two chat models.

This script alternates prompts between OpenAI's Chat Completions API and
DeepSeek's API to produce a transcript that can be reviewed later.  It is
intended as a starting point for building richer multi-agent tooling.
"""

from __future__ import annotations

import argparse
import json
import os
import textwrap
import time
from dataclasses import dataclass
from typing import Iterable, List

import requests


OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"


@dataclass
class ModelConfig:
    """Container for the metadata needed to call a chat completion API."""

    name: str
    api_key_env: str
    api_url: str
    default_model: str
    system_instruction: str

    def build_messages(self, topic: str, transcript: Iterable[str]) -> List[dict[str, str]]:
        conversation = "\n".join(transcript).strip()
        if conversation:
            conversation += "\n"
        prompt = textwrap.dedent(
            f"""
            Topic: {topic}

            Conversation so far:
            {conversation}
            Respond with the next contribution. Keep the conversation moving and ask
            clarifying questions when helpful.
            """
        ).strip()
        return [
            {"role": "system", "content": self.system_instruction},
            {"role": "user", "content": prompt},
        ]


class ChatClient:
    """Simple wrapper around an OpenAI-compatible chat completion endpoint."""

    def __init__(self, config: ModelConfig) -> None:
        api_key = os.getenv(config.api_key_env)
        if not api_key:
            raise RuntimeError(
                f"Missing API key for {config.name}. Set the {config.api_key_env} environment variable."
            )
        self._config = config
        self._api_key = api_key

    def complete(self, topic: str, transcript: Iterable[str], model_override: str | None = None) -> str:
        payload = {
            "model": model_override or self._config.default_model,
            "messages": self._config.build_messages(topic, transcript),
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        response = requests.post(self._config.api_url, headers=headers, data=json.dumps(payload), timeout=60)
        response.raise_for_status()
        data = response.json()
        try:
            return data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError) as error:
            raise RuntimeError(f"Unexpected response payload from {self._config.name}: {data}") from error


OPENAI_CONFIG = ModelConfig(
    name="OpenAI",
    api_key_env="OPENAI_API_KEY",
    api_url=OPENAI_API_URL,
    default_model="gpt-4o-mini",
    system_instruction="You are ChatGPT, an insightful AI collaborator."
)

DEEPSEEK_CONFIG = ModelConfig(
    name="DeepSeek",
    api_key_env="DEEPSEEK_API_KEY",
    api_url=DEEPSEEK_API_URL,
    default_model="deepseek-chat",
    system_instruction="You are DeepSeek, an analytical AI strategist."
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a debate between ChatGPT and DeepSeek.")
    parser.add_argument("topic", help="Topic that both agents should discuss.")
    parser.add_argument("--turns", type=int, default=10, help="Number of individual messages in the transcript.")
    parser.add_argument("--first-speaker", choices=["openai", "deepseek"], default="openai")
    parser.add_argument("--openai-model", help="Override the default OpenAI model identifier.")
    parser.add_argument("--deepseek-model", help="Override the default DeepSeek model identifier.")
    parser.add_argument("--delay", type=float, default=0.0, help="Optional pause (seconds) between turns for readability.")
    parser.add_argument(
        "--output", "-o", help="Write the transcript to this file instead of standard output."
    )
    return parser.parse_args()


def alternating_clients(first_speaker: str) -> List[str]:
    order = ["openai", "deepseek"]
    if first_speaker == "deepseek":
        order.reverse()
    return order


def run_debate(
    topic: str,
    turns: int,
    first_speaker: str,
    openai_model: str | None,
    deepseek_model: str | None,
    delay: float,
) -> List[str]:
    openai_client = ChatClient(OPENAI_CONFIG)
    deepseek_client = ChatClient(DEEPSEEK_CONFIG)

    clients = {
        "openai": (openai_client, "ChatGPT", openai_model),
        "deepseek": (deepseek_client, "DeepSeek", deepseek_model),
    }

    transcript: List[str] = []
    order = alternating_clients(first_speaker)

    for turn in range(turns):
        key = order[turn % 2]
        client, display_name, model_override = clients[key]
        reply = client.complete(topic, transcript, model_override)
        line = f"{display_name}: {reply}"
        transcript.append(line)
        print(line)
        if delay:
            time.sleep(delay)

    return transcript


def main() -> None:
    args = parse_args()
    transcript = run_debate(
        topic=args.topic,
        turns=args.turns,
        first_speaker=args.first_speaker,
        openai_model=args.openai_model,
        deepseek_model=args.deepseek_model,
        delay=args.delay,
    )

    if args.output:
        with open(args.output, "w", encoding="utf-8") as handle:
            handle.write("\n".join(transcript))


if __name__ == "__main__":
    main()
