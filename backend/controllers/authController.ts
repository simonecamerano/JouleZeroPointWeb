import { Request, Response } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User, { IUser } from '../models/User';
import Deck from '../models/Deck';
import Message from '../models/Message';
import logger from '../config/logger';
import * as emailService from '../services/emailService';

/**
 * Authentication Controller (TypeScript).
 * 
 * Manages the lifecycle of user identities including registration,
 * secure login, password recovery, and profile updates.
 */

/**
 * Utility for generating session access tokens.
 * Issues a JWT signed with the environment secret, valid for a 24-hour window.
 * 
 * @param id - The Unique Identifier of the user entity.
 * @returns The encoded JWT token.
 */
const generateToken = (id: string | any): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment variables');
  }
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '24h',
  });
};

/**
 * @desc    Register a new developer/user profile
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
export const registerUser = async (req: Request, res: Response) => {
  try {
    const { username, email, password, privacyAccepted } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Tutti i campi sono obbligatori.' });
    }

    if (!privacyAccepted) {
      return res.status(400).json({ error: 'È necessario accettare l\'informativa sulla privacy per procedere.' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'La passphrase deve essere di almeno 8 caratteri.' });
    }

    // Check for existing email or username
    const userExists = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }],
    });

    if (userExists) {
      // Unverified account → resend verification email
      if (!userExists.isVerified) {
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const salt = await bcrypt.genSalt(10);
        userExists.password = await bcrypt.hash(password, salt);
        userExists.verificationToken = verificationToken;
        userExists.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
        userExists.privacyAccepted = true;
        userExists.privacyAcceptedAt = new Date();
        await userExists.save();

        await emailService.sendVerificationEmail(userExists.email, verificationToken);
        return res
          .status(200)
          .json({ message: 'Email di verifica reinviata. Controlla la tua casella.' });
      }

      // Email/username already in use
      return res.status(409).json({ error: 'Email già in uso.' });
    }

    // Create new user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const user = await User.create({
      username: username.toLowerCase(),
      usernameDisplay: username,
      email: email.toLowerCase(),
      password: hashedPassword,
      verificationToken,
      verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      privacyAccepted: true,
      privacyAcceptedAt: new Date(),
      privacyVersion: 'v1.0-2026-03'
    });

    if (user) {
      logger.info(`VIGIL_SYSTEM: New constructor registered (pending config): ${username}`);
      await emailService.sendVerificationEmail(user.email, verificationToken);
      res
        .status(201)
        .json({ message: 'Credenziali accettate. Controlla la casella di posta per verificare il profilo.' });
    }
  } catch (error) {
    if ((error as any).code === 11000) {
      return res.status(409).json({ error: 'Email già in uso.' });
    }
    logger.error(`REGISTRATION_ERROR: ${(error as Error).message}`);
    res.status(500).json({ error: 'Errore durante la codifica del profilo genetico.' });
  }
};

/**
 * @desc    Authenticate user and retrieve session token
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
export const loginUser = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user: IUser | null = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(401).json({ error: 'Credenziali non sincronizzate con il database centrale.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenziali non sincronizzate con il database centrale.' });
    }

    if (!user.isVerified) {
      return res
        .status(403)
        .json({ error: "Account non verificato. Reinvia l'email di attivazione." });
    }

    // Retention clock: the inactivity purge counts from this date, so it has to
    // be written on every successful access. Failing to record it must not block
    // the login, hence the awaited update is kept outside the response payload.
    user.lastLogin = new Date();
    await user.save();

    res.json({
      id: user._id,
      username: user.usernameDisplay || user.username,
      email: user.email,
      token: generateToken(user._id),
      isAdmin: user.isAdmin || false,
    });
  } catch (error) {
    logger.error(`LOGIN_ERROR: ${(error as Error).message}`);
    res.status(500).json({ error: 'Errore di sistema durante il protocollo di accesso.' });
  }
};

/**
 * @desc    Purge user account and associated data
 * @route   DELETE /api/v1/users/profile
 * @access  Private/Protected
 */
export const deleteAccount = async (req: any, res: Response) => {
  try {
    const user: IUser | null = await User.findById(req.user._id);

    if (user) {
      const usernameLower = user.username.toLowerCase();

      // Purge associated decks
      const deckResult = await Deck.deleteMany({ creator: usernameLower });
      logger.info(`VIGIL_SYSTEM: ${deckResult.deletedCount} deck artifacts for ${user.username} have been purged.`);

      // Purge the terminal conversation. Until 2026-08-24 these messages
      // survived the deletion of the account they belonged to, which left
      // personal data behind after an erasure request.
      const messageResult = await Message.deleteMany({ userId: user._id });
      logger.info(`VIGIL_SYSTEM: ${messageResult.deletedCount} terminal messages for ${user.username} have been purged.`);

      // Also remove user votes from other creators' decks
      await Deck.updateMany({}, { $pull: { votes: user.username } });

      await User.deleteOne({ _id: req.user._id });
      logger.info(`VIGIL_SYSTEM: Account purged: ${user.username}`);

      res.json({ message: 'Dati genetici e mazzi associati rimossi con successo dall\'archivio centrale.' });
    } else {
      res.status(404).json({ error: 'Costruttore non trovato.' });
    }
  } catch (error) {
    logger.error(`DELETE_ERROR: ${(error as Error).message}`);
    res.status(500).json({ error: 'Errore durante la sequenza di eliminazione.' });
  }
};

/**
 * @desc    Verify constructor email via magic token
 * @route   GET /api/v1/auth/verify/:token
 * @access  Public
 */
export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const user: IUser | null = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ error: 'Gettone di attivazione non valido o scaduto.' });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    logger.info(`VIGIL_SYSTEM: Constructor verified: ${user.username}`);
    res.json({ message: 'Profilo genetico attivato con successo. Accesso consentito.' });
  } catch (error) {
    logger.error(`VERIFY_ERROR: ${(error as Error).message}`);
    res.status(500).json({ error: 'Errore di sistema durante la validazione.' });
  }
};

/**
 * @desc    Request Password Reset Link
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const user: IUser | null = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(200).json({ message: 'Se la mail risulta iscritta, i parametri di recupero sono stati inviati.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour
    await user.save();

    await emailService.sendPasswordResetEmail(user.email, resetToken);

    res.status(200).json({ message: 'Se la mail risulta iscritta, i parametri di recupero sono stati inviati.' });
  } catch (error) {
    logger.error(`FORGOT_PW_ERROR: ${(error as Error).message}`);
    res.status(500).json({ error: 'Errore di sistema nella generazione del recupero.' });
  }
};

/**
 * @desc    Reset Password via Magic Token
 * @route   POST /api/v1/auth/reset-password/:token
 * @access  Public
 */
export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const user: IUser | null = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'La nuova passphrase deve essere di almeno 8 caratteri.' });
    }

    if (!user) {
      return res.status(400).json({ error: 'Gettone di recupero non esistente o scaduto (limite 1h).' });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    logger.info(`VIGIL_SYSTEM: Constructor password reset: ${user.username}`);
    res.json({ message: 'Passphrase aggiornata con successo. Puoi ora accedere.' });
  } catch (error) {
    logger.error(`RESET_PW_ERROR: ${(error as Error).message}`);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento dell\'enclave crittografica.' });
  }
};

/**
 * @desc    Logout user / clear session
 * @route   POST /api/v1/auth/logout
 * @access  Public
 */
export const logoutUser = async (req: Request, res: Response) => {
  res.status(200).json({ message: 'Sessione terminata con successo.' });
};

/**
 * @desc    Update user profile
 * @route   PUT /api/v1/auth/profile
 * @access  Private/Protected
 */
export const updateProfile = async (req: any, res: Response) => {
  try {
    const user: IUser | null = await User.findById(req.user._id);

    if (user) {
      if (req.body.username) {
        user.usernameDisplay = req.body.username;
      }

      if (req.body.password) {
        if (req.body.password.length < 8) {
          return res.status(400).json({ error: 'La nuova passphrase deve essere di almeno 8 caratteri.' });
        }
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(req.body.password, salt);
      }

      const updatedUser: IUser = await user.save();

      res.json({
        id: updatedUser._id,
        username: updatedUser.usernameDisplay || updatedUser.username,
        email: updatedUser.email,
        token: generateToken(updatedUser._id),
      });
    } else {
      res.status(404).json({ error: 'Costruttore non trovato.' });
    }
  } catch (error) {
    logger.error(`UPDATE_PROFILE_ERROR: ${(error as Error).message}`);
    res.status(500).json({ error: 'Errore durante l\'aggiornamento della configurazione profilo.' });
  }
};

/**
 * @desc    Resend verification email
 * @route   POST /api/v1/auth/resend-verification
 * @access  Public
 */
export const resendVerificationEmail = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Frequenza (Email) mancante.' });
    }

    const user: IUser | null = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ error: 'Utente non trovato.' });
    }

    if (user.isVerified) {
      return res.status(400).json({ error: 'Account già verificato.' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = verificationToken;
    user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    await emailService.sendVerificationEmail(user.email, verificationToken);

    res.status(200).json({ message: 'Email di attivazione reinviata. Controlla la tua posta.' });
  } catch (error) {
    logger.error(`RESEND_VERIFICATION_ERROR: ${(error as Error).message}`);
    res.status(500).json({ error: 'Errore durante la reinvio del segnale di attivazione.' });
  }
};
