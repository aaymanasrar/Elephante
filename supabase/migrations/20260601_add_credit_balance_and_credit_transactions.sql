-- Add credit balance tracking to profiles and create a credit transaction ledger

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS credit_balance INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount <> 0),
  balance_after integer NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('debit', 'credit', 'refund', 'adjustment')),
  description text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at);

ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own credit transactions"
  ON credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credit transactions"
  ON credit_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION deduct_image_credit(
  request_user_id uuid,
  amount integer,
  description text DEFAULT '',
  metadata jsonb DEFAULT '{}'::jsonb
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  new_balance integer;
BEGIN
  UPDATE profiles
  SET credit_balance = credit_balance - amount
  WHERE id = request_user_id AND credit_balance >= amount
  RETURNING credit_balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient_credit';
  END IF;

  INSERT INTO credit_transactions (
    user_id,
    amount,
    balance_after,
    transaction_type,
    description,
    metadata
  ) VALUES (
    request_user_id,
    -amount,
    new_balance,
    'debit',
    description,
    metadata
  );

  RETURN new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION refund_image_credit(
  request_user_id uuid,
  amount integer,
  description text DEFAULT '',
  metadata jsonb DEFAULT '{}'::jsonb
) RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  new_balance integer;
BEGIN
  UPDATE profiles
  SET credit_balance = credit_balance + amount
  WHERE id = request_user_id
  RETURNING credit_balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'invalid_user';
  END IF;

  INSERT INTO credit_transactions (
    user_id,
    amount,
    balance_after,
    transaction_type,
    description,
    metadata
  ) VALUES (
    request_user_id,
    amount,
    new_balance,
    'refund',
    description,
    metadata
  );

  RETURN new_balance;
END;
$$;
