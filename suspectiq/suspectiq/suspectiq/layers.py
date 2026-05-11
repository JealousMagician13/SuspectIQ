import tensorflow as tf
from tensorflow.keras import layers


@tf.keras.utils.register_keras_serializable(package="CriminalDetector")
class TemporalAttention(layers.Layer):
    """
    Temporal attention layer that learns which frames in a sequence
    are most relevant for classification.
    """

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.score = layers.Dense(1, use_bias=True)

    def call(self, x, training=None):
        w = tf.nn.softmax(self.score(x), axis=1)  # (B, T, 1)
        return tf.reduce_sum(w * x, axis=1)        # (B, D)

    def get_config(self):
        cfg = super().get_config()
        cfg["score_config"] = self.score.get_config()
        return cfg

    @classmethod
    def from_config(cls, config):
        config.pop("score_config", None)
        return cls(**config)
