import { useNavigate , Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

// Context imports
import { useUser } from "../contexts/UserContext"; 

// Icon imports
const WebcamLogo = "/assets/webcam-icon.png";
const HandTrackingLogo = "/assets/handtracking-icon.png";
const FreeLogo = "/assets/free-icon.png";
const OpenSourceLogo = "/assets/opensource-icon.png";
const CommunityLogo = "/assets/community-icon.png";

// Image imports
const YourProjectLogo = "/assets/square.jpg";
const FaceBlocks = "/assets/faceblocks.jpg";

// Component imports
import Footer from "../components/Footer";

// CSS imports
import './Home.css';

// Define the types for the card elements
type AssessmentCardProps = {
  title: string;
  subtitle: string;
  to: string;
  image: string;
  buttonText: string;
};

type FeatureCardProps = {
  icon: string;   
  label: string;
};

interface PapersCardProps {
  title: string;
  authors: string;
  link: string;
}

interface ProjectsCardProps {
  title: string;
  description: string;
}

// Main code
const Home = () => {
  const navigate = useNavigate();
  
  // User context
  const {userSettings, loading: userSettingsLoading} = useUser();
  const [userSettingsLoaded, setUserSettingsLoaded] = useState(false);

  // The user settings have been loaded
  useEffect(() => {
    if (!userSettingsLoading && userSettings) {
      setUserSettingsLoaded(true);
    }
  }, [userSettingsLoading, userSettings]);
  
  // Check if user settings are loaded and currentUser is available, then check if hand size is saved in userSettings
  useEffect(() => {
    if (userSettings) {
      console.log(
        'User settings profile:',
        userSettings.impairedHand,
        userSettings.spasticitySeverity,
        userSettings.pointingHandSize,
        userSettings.targetHandSize
      );
    }
  }, [userSettingsLoaded]); 

  // Define what goes inside each card
  const features: FeatureCardProps[] = [
    { icon: WebcamLogo, label: "Single Camera" },
    { icon: HandTrackingLogo, label: "Hand Tracking" },
    { icon: FreeLogo, label: "Free" },
    { icon: OpenSourceLogo, label: "Open Source" },
    { icon: CommunityLogo, label: "Collaborative" }
  ];

  const assessments: AssessmentCardProps[] = [
    {
      title: "Block Placement Test",
      subtitle: "Test how many blocks you can place in a target area with your hand.",
      to: "/BlockPlacementTest",
      image: YourProjectLogo,
      buttonText: "Try it"
    },
    {
      title: "Face Blocks",
      subtitle: "Pick Blocks from parts of your body and place them on a target area.",
      to: "/FaceBlocks",
      image: FaceBlocks,
      buttonText: "Try it"
    },
    {
      title: "Build your own",
      subtitle: "Documentation on how to build your own proprioceptive assessment or game.",
      to: "/documentation",
      image: OpenSourceLogo,
      buttonText: "How?"
    }
  ];

  const papers = [
    {
      title: "Using a Webcam to Assess Upper Extremity Proprioception: Experimental Validation and Application to Persons Post Stroke.",
      authors: "G. Cornella-Barba, A.J. Farrens, C.A. Johnson, L. Garcia-Fernandez, V. Chan, D.J. Reinkensmeyer",
      link: "https://www.mdpi.com/1424-8220/24/23/7434",
    },
    {
      title: "Symmetry: Design and initial testing of a computer-vision based game for bilateral, upper limb, sensory motor training",
      authors: "Quiroga-Sueiras, M.",
      link: "https://escholarship.org/uc/item/6ks051jm",
    },
    {
      title: "A Systematic Review of the Learning Dynamics of Proprioception Training: Specificity, Acquisition, Retention, and Transfer",
      authors: "H.G. Seo, S.J. Yun, A.J. Farrens, C.A. Johnson, D.J. Reinkensmeyer",
      link: "https://journals.sagepub.com/doi/10.1177/15459683231207354",
    },
    {
      title: "Somatosensory system integrity explains differences in treatment response after stroke",
      authors: "M.L. Ingemanson, J.R. Rowe, V. Chan, E.T. Wolbrecht, D.J. Reinkensmeyer, S.C. Cramer",
      link: "https://pubmed.ncbi.nlm.nih.gov/30728310/",
    },
  ];

  const projects = [
    {
      title: "Joint Position Matching",
      description: "Match one arm's position with the other without visual feedback.",
    },
    {
      title: "Arm Repositioning Accuracy",
      description: "Replicate a guided arm position after returning to rest, without vision.",
    },
    {
      title: "Trajectory Tracing",
      description: "Trace a predefined path in the air without vision; compare hand path to reference.",
    },
    {
      title: "Proprioceptive Drift",
      description: "Hold an arm position with eyes closed and measure positional drift over time.",
    },
    {
      title: "Reaching Without Vision",
      description: "Reach to memorized targets with eyes closed and assess endpoint accuracy.",
    },
    {
      title: "Passive-to-Active Replication",
      description: "Replicate a passively positioned arm movement actively without vision.",
    },
    {
      title: "Movement Recreation (Same Arm)",
      description: "Observe a movement visually, then recreate it without vision using proprioception.",
    },
    {
      title: "Virtual Ball Balance",
      description: "Balance a virtual object using wrist proprioception, without visual or auditory feedback.",
    },
  ];


  const AssessmentCard: React.FC<AssessmentCardProps> = ({ title, subtitle, to, image, buttonText }) => (
    <div className="card">
      <h2 className="card-title">{title}</h2>
      <p className="card-subtitle">{subtitle}</p>
      <img src={image} alt={title} className="card-image" />
      <Link
        to={to}
        onClick={(e) => handleClick(e, to, title)}
        className={`card-button`}
       
      >
        {buttonText}
      </Link>
    </div>
  );

  const PaperCard: React.FC<PapersCardProps> = ({ title, authors, link }) => (
    <div className="card" >
      <h2 className="paper-title">{title}</h2>
      <p className="paper-authors">{authors}</p>
      <a href={link} target="_blank" rel="noopener noreferrer" className="paper-link">
        View Paper
      </a>
    </div>
  );

  const ProjectCard: React.FC<ProjectsCardProps> = ({ title, description }) => (
    <div className="card" >
      <h2 className="paper-title">{title}</h2>
      <p className="paper-authors">{description}</p>
    </div>
  );

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, to: string, title: string) => {
    

    // User is logged in, but we need to check if the user settings are loaded
    if (!userSettings && !userSettingsLoaded) {
      e.preventDefault();
      console.log("User settings not loaded yet");
      return;
    }

    // User is logged in and settings are loaded, but we need to check if the user settings are complete and redirect to setting page
    const missingSettings =
      !userSettings ||
      userSettings.impairedHand === "none" ||
      userSettings.spasticitySeverity === "none" ||
      userSettings.pointingHandSize === 0 ||
      userSettings.targetHandSize === 0;

    if (missingSettings) {
      e.preventDefault();
      console.log("User logged in, but missing profile settings info");
      navigate("/settings");
      return;
    }

    if (title === "Proprio") {
      e.preventDefault();
      window.open(to, '_blank', 'noopener,noreferrer');
    } else {
      navigate(to);
    }
  };
  
  return (
    <div className="page-container">
      
      {/* Main title and Heading */}
      <div className="webtext-container">
        <h1 className="webpageTitle">
          Assessing <span className="highlight-word">Proprioception</span> with a Single Webcam
        </h1>
        <h2 className="webpageSubTitle">
          This project uses MediaPipe to track hand movements and is open source, inviting the community to build computer vision tools that deepen our understanding of proprioception.
        </h2>
      </div>

      {/* Website features and project characteristics */}
      <div className="feature-row">
        {features.map((feature, index) => (
          <div className="feature-item" key={index}>
            <img src={feature.icon} alt={feature.label} className="feature-icon" />
            <p className="feature-label">{feature.label}</p>
          </div>
        ))}
      </div>

      {/* Assessments and Training Platforms */}
      <main className="cards-container">
        {assessments.map((card, index) => (
          <AssessmentCard key={index} {...card} />
        ))}
      </main>

      {/* Supported by Research */}
      <div className="webtext-container">
        <h1 className="webpageTitle">
          Supported by <span className="highlight-word">Research</span>
        </h1>
        <p className="webpageSubTitle">
          This project is part of a Ph.D. research initiative at the University of California, Irvine. It explores the development of computer vision tools for proprioceptive assessment using accessible technology.
        </p>
      </div>
      <div className="cards-container">
        {papers.map((paper, i) => (
          <PaperCard key={i} {...paper} />
        ))}
      </div>
      
      {/* Want to Collaborate? */}
      <div className="webtext-container" style={{ backgroundColor: 'rgb(221, 218, 218)' }}>
        <h1 className="webpageTitle">
          Want to <span className="highlight-word">collaborate</span>?
        </h1>
        <h2 className="webpageSubTitle">
          Do you have an idea for building a proprioceptive assessment or game?
        </h2>
        <p className="webpageSubTitle">
          We welcome contributions and feedback from the community to expand the project.
        </p>
      </div>
      <div className="cards-container" style={{ backgroundColor: 'rgb(221, 218, 218)' }}>
        {projects.map((paper, i) => (
          <ProjectCard key={i} {...paper} />
        ))}
      </div>

      {/* Contact us */}
      <div className="webtext-container">
        <h1 className="webpageTitle">
          <span className="highlight-word">Contact </span>us
        </h1>
        <p className="contact-text">
          We'd love to hear from you! If you have any questions, suggestions, or feedback, feel free to reach out.
        </p>
        <div className="contact-box">
          <p className="webpageSubTitle">
            📧 Email:{" "}
            <a href="mailto:cornellg@uci.edu">cornellg@uci.edu</a>
          </p>
        </div>
      </div>
      
      {/* Footer */}
      <Footer text="© 2025 Proprio Vision. All rights reserved." />
    </div>
  );
};

export default Home;
